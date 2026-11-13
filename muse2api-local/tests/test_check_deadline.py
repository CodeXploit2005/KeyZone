"""Offline checks: verification cannot wait forever or corrupt saved sessions."""
import asyncio
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import Mock, patch
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from cdp import CDP, CDPError
import websocket


class Socket:
    def __init__(self, closed=False): self.timeout=180; self.closed=closed
    def gettimeout(self): return self.timeout
    def settimeout(self, value): self.timeout=value
    def send(self, value): pass
    def recv(self):
        if self.closed: raise OSError("closed")
        time.sleep(self.timeout)
        raise websocket.WebSocketTimeoutException()


class DeadlineTests(unittest.TestCase):
    def client(self, closed=False):
        client=object.__new__(CDP);client.ws=Socket(closed);client.timeout=180;client._id=0;client._lock=threading.Lock()
        return client

    def test_idle_socket_obeys_total_operation_budget(self):
        client=self.client();start=time.monotonic()
        with self.assertRaises(TimeoutError), CDP.operation_timeout(.03): client.send("Runtime.evaluate")
        self.assertLess(time.monotonic()-start,.3)
        self.assertEqual(client.ws.timeout,180)
        self.assertFalse(client._lock.locked())

    def test_lock_contention_is_bounded(self):
        client=self.client();client._lock.acquire();start=time.monotonic()
        try:
            with self.assertRaises(TimeoutError), CDP.operation_timeout(.03): client.send("Runtime.evaluate")
            self.assertLess(time.monotonic()-start,.3)
        finally: client._lock.release()

    def test_closed_socket_fails_instead_of_spinning(self):
        client=self.client(True)
        with self.assertRaises(CDPError): client.send("Runtime.evaluate")
        self.assertFalse(client._lock.locked())


class AccountCheckTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.home=tempfile.TemporaryDirectory()
        os.environ.update(MUSE2API_HOME=cls.home.name,MUSE2API_DATA_DIR=cls.home.name,MUSE2API_PROFILE_ROOT=cls.home.name,MUSE2API_KEY="fixture-only")
        import app
        cls.app=app

    def setUp(self):
        self.old_lock=self.app.GEN_LOCK
        self.app.GEN_LOCK=self.app.ConcurrencyLock(1)
        self.account=self.app.store.add_account({"hatch_sess":"fixture"})
        self.account["ok"]=True

    def tearDown(self):
        self.app.GEN_LOCK=self.old_lock

    def test_busy_generation_returns_immediately(self):
        self.app.GEN_LOCK.acquire()
        try:
            with patch.object(self.app.engine,"start") as start:
                result=asyncio.run(self.app.test_account(self.account["id"]))
                body=json.loads(result.body);self.assertTrue(body["busy"]);start.assert_not_called()
        finally: self.app.GEN_LOCK.release()

    def test_timeout_keeps_cookies_and_prior_auth_state(self):
        with patch.object(self.app.engine,"start",side_effect=TimeoutError()),patch.object(self.app.engine,"close_current_page"):
            result=asyncio.run(self.app.test_account(self.account["id"]))
        self.assertTrue(json.loads(result.body)["timeout"])
        self.assertEqual(self.account["cookies"],{"hatch_sess":"fixture"})
        self.assertTrue(self.account["ok"])
        self.assertFalse(self.app.GEN_LOCK.locked())

    def test_ready_probe_does_not_read_quota_or_renew_session(self):
        with patch.object(self.app.engine,"start"),patch.object(self.app.engine,"ensure_page") as page,patch.object(self.app.engine,"_check_workspace"),patch.object(self.app.engine,"close_current_page"),patch.object(self.app.engine,"quota") as quota,patch.object(self.app,"_sync_cookies",return_value=False):
            result=asyncio.run(self.app.test_account(self.account["id"]))
        self.assertTrue(result["ok"]);quota.assert_not_called()
        self.assertFalse(page.call_args.kwargs["renew_session"])
        self.assertEqual(self.account["workspace_status"],"ready")
        self.assertFalse(self.app.GEN_LOCK.locked())

    def test_chat_account_acquisition_failure_is_not_an_empty_reply(self):
        with patch.object(self.app.ACCOUNT_POOL,"acquire",side_effect=self.app.MuseGenerationError("busy")),patch.object(self.app.engine,"close_current_page"):
            with self.assertRaisesRegex(self.app.MuseGenerationError,"busy"):
                list(self.app.safe_chat_stream({},"fixture",None,1,self.account["id"]))

    def test_chat_consumer_deadline_stops_waiting_and_releases_slot(self):
        def delayed(*args,**kwargs):
            time.sleep(.15)
            if not kwargs["stop_event"].is_set(): yield "late"
        with patch.object(self.app.ACCOUNT_POOL,"acquire",return_value=self.account),patch.object(self.app,"_renew_and_persist",return_value=None),patch.object(self.app.engine,"start"),patch.object(self.app.engine,"ensure_page"),patch.object(self.app.engine,"chat_stream",side_effect=delayed),patch.object(self.app.engine,"close_current_page"),patch.object(self.app.engine,"reset_thread"):
            start=time.monotonic()
            with self.assertRaisesRegex(self.app.MuseGenerationError,"Muse"):
                list(self.app.safe_chat_stream({},"fixture",None,.04,self.account["id"]))
            self.assertLess(time.monotonic()-start,.12)
            time.sleep(.2)
        self.assertFalse(self.app.GEN_LOCK.locked())


class BrowserStartupTests(unittest.TestCase):
    def test_warmup_and_manual_start_launch_one_process(self):
        from engine import MuseEngine
        with tempfile.TemporaryDirectory() as home:
            cfg=SimpleNamespace(profile_dir=home,data_dir=home,home_dir=home,extra_path="",chromium="fixture-browser",cdp_port=12345)
            engine=MuseEngine(cfg);proc=Mock();proc.poll.return_value=None;errors=[]
            def launch(*args,**kwargs):time.sleep(.03);return proc
            def version(*args,**kwargs):
                if engine.proc is None:raise OSError("not started")
                return {"webSocketDebuggerUrl":"ws://127.0.0.1:12345/devtools/browser/fixture"}
            def run():
                try:engine.start()
                except Exception as exc:errors.append(exc)
            with patch("engine.subprocess.Popen",side_effect=launch) as popen,patch("engine.http_json",side_effect=version),patch("engine.CDP.__init__",return_value=None):
                threads=[threading.Thread(target=run) for _ in range(2)]
                for thread in threads:thread.start()
                for thread in threads:thread.join(1)
                self.assertFalse(errors);self.assertEqual(popen.call_count,1)
                self.assertTrue(any("cdp-12345" in arg for arg in popen.call_args.args[0]))
            if engine._log:engine._log.close()

if __name__ == "__main__": unittest.main()

"""极简 Chrome DevTools Protocol 客户端（仅依赖 websocket-client / requests）。"""
from __future__ import annotations

import json
import time

import threading
from contextlib import contextmanager

import requests
import websocket


class CDPError(RuntimeError):
    pass


class CDP:
    _limits = threading.local()

    @staticmethod
    @contextmanager
    def operation_timeout(seconds):
        previous = getattr(CDP._limits, "deadline", None)
        deadline = time.monotonic() + seconds
        CDP._limits.deadline = min(previous, deadline) if previous is not None else deadline
        try:
            yield
        finally:
            CDP._limits.deadline = previous

    @staticmethod
    def remaining_timeout(default):
        deadline = getattr(CDP._limits, "deadline", None)
        remaining = default if deadline is None else min(default, deadline - time.monotonic())
        if remaining <= 0:
            raise TimeoutError("Workspace verification timed out.")
        return remaining

    def __init__(self, ws_url: str, timeout: float = 90.0, max_size: int = 256 << 20):
        self.ws = websocket.create_connection(ws_url, timeout=self.remaining_timeout(timeout), max_size=max_size)
        self.timeout = timeout
        self._id = 0
        self._lock = threading.Lock()

    def send(self, method: str, params: dict | None = None, timeout: float | None = None):
        budget = self.remaining_timeout(timeout or self.timeout)
        deadline = time.monotonic() + budget
        if not self._lock.acquire(timeout=budget):
            raise TimeoutError(f"CDP {method} timed out waiting for browser.")
        previous_timeout = self.ws.gettimeout()
        try:
            self.ws.settimeout(self.remaining_timeout(max(0, deadline - time.monotonic())))
            self._id += 1
            mid = self._id
            self.ws.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
            while time.monotonic() < deadline:
                self.ws.settimeout(self.remaining_timeout(max(0, deadline - time.monotonic())))
                try:
                    msg = json.loads(self.ws.recv())
                except websocket.WebSocketTimeoutException:
                    continue
                except Exception as exc:
                    raise CDPError(f"{method}: browser connection closed.") from exc
                if msg.get("id") == mid:
                    if "error" in msg:
                        raise CDPError(f"{method}: {msg['error']}")
                    return msg
            raise TimeoutError(f"CDP {method} 超时")
        finally:
            try:
                self.ws.settimeout(previous_timeout)
            finally:
                self._lock.release()

    def js(self, expr: str, await_promise: bool = False, timeout: float | None = None):
        r = self.send("Runtime.evaluate",
                      {"expression": expr, "returnByValue": True,
                       "awaitPromise": await_promise}, timeout)
        res = r.get("result", {}).get("result", {})
        if "value" in res:
            return res["value"]
        return r.get("result")

    def pump(self, seconds: float, on_event=None, sock_timeout: float = 2.0):
        """在 seconds 秒内持续读取事件，交给回调处理。"""
        end = time.time() + seconds
        self.ws.settimeout(sock_timeout)
        while time.time() < end:
            try:
                ev = json.loads(self.ws.recv())
            except Exception:  # noqa: BLE001
                continue
            if on_event and "method" in ev:
                on_event(ev)

    def close(self):
        with self._lock:
            try:
                self.ws.close()
            except Exception:  # noqa: BLE001
                pass


def http_json(url: str, timeout: float = 5.0):
    return requests.get(url, timeout=CDP.remaining_timeout(timeout)).json()

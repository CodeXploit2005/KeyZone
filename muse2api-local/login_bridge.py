"""Interactive sign-in prototype. Dedicated, expiring browser; no password storage."""
from __future__ import annotations

from dataclasses import replace
import json
import math
import secrets
import shutil
import socket
import tempfile
import threading
import time

from fastapi import Body, Depends, HTTPException

from engine import ESSENTIAL_COOKIES, MuseEngine, MuseAuthError, MuseWorkspaceDisconnectedError

TTL = 15 * 60
WIDTH, HEIGHT = 420, 760


def valid_coordinates(x, y):
    return (isinstance(x, (int, float)) and isinstance(y, (int, float))
            and math.isfinite(x) and math.isfinite(y)
            and 0 <= x <= WIDTH and 0 <= y <= HEIGHT)


class LoginSession:
    def __init__(self, cfg, replace_id=None):
        self.id = secrets.token_urlsafe(32)
        self.replace_id = replace_id
        self.created = time.monotonic()
        self.lock = threading.RLock()
        self.closed = False
        self.root = tempfile.mkdtemp(prefix="moonreel-signin-")
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        self.engine = MuseEngine(replace(cfg, cdp_port=port, profile_root=self.root))
        self.page = None
        try:
            self.engine.start()
            self.page = self.engine._open_page()
            self.engine.page = self.page
            self.page.send("Emulation.setDeviceMetricsOverride", {
                "width": WIDTH, "height": HEIGHT, "deviceScaleFactor": 1, "mobile": False,
            })
            self.page.send("Page.navigate", {"url": cfg.site_url})
        except Exception:
            self.close()
            raise

    def close(self):
        with self.lock:
            if self.closed:
                return
            self.closed = True
            if self.page:
                self.page.close()
            self.engine.stop()
            if self.engine._log:
                self.engine._log.close()
            # Only the temporary profile created for this session is removed.
            shutil.rmtree(self.root, ignore_errors=True)

    def state(self):
        with self.lock:
            if self.closed:
                raise HTTPException(410, "Phiên kết nối đã đóng. Hãy mở lại.")
            meta = self.page.js("""(() => {
              let otp = null;
              const fields = [...document.querySelectorAll('input')].map((el, index) => {
                const r = el.getBoundingClientRect();
                const fingerprint = JSON.stringify([location.origin,index,el.type,el.name,el.id,el.placeholder,el.autocomplete]);
                // OTP widgets draw boxes but receive text through a tiny backing input.
                if (el.autocomplete.split(/\s+/).includes('one-time-code') && !el.disabled
                    && r.width > 0 && r.height > 0 && el.maxLength >= 4 && el.maxLength <= 10) {
                  otp = {index, fingerprint, length: el.maxLength};
                  return null;
                }
                if (!['text','email','tel','password','number','search'].includes(el.type)
                    || r.width < 10 || r.height < 10 || r.bottom <= 0 || r.top >= innerHeight
                    || getComputedStyle(el).visibility === 'hidden' || el.disabled) return null;
                return {index, fingerprint: JSON.stringify([location.origin,index,el.type,el.name,el.id,el.placeholder,el.autocomplete]), type: el.type, placeholder: el.placeholder,
                  label: el.getAttribute('aria-label') || el.placeholder || el.type,
                  autocomplete: el.autocomplete, x:r.x, y:r.y, width:r.width, height:r.height};
              }).filter(Boolean);
              const body = document.body?.innerText || '';
              const alerts = [...document.querySelectorAll('[role="alert"]')].map(e => e.innerText.trim()).filter(Boolean);
              const challenge = [...document.querySelectorAll('iframe')].some(e => /captcha|challenge/i.test(e.src + ' ' + e.title));
              return {origin: location.origin, fields, otp, challenge,
                message: alerts.join(' ').slice(0, 400),
                waiting: /check your email|check your phone|approve.*sign.?in/i.test(body),
                chat: !!document.querySelector('textarea') && location.hostname === 'muse.ai'};
            })()""") or {}
            screenshot = self.page.send("Page.captureScreenshot", {
                "format": "jpeg", "quality": 65, "captureBeyondViewport": False,
            }).get("result", {}).get("data", "")
            return {"image": screenshot, "width": WIDTH, "height": HEIGHT,
                    "origin": meta.get("origin", ""), "fields": meta.get("fields", []),
                    "can_finish": bool(meta.get("chat")), "otp": meta.get("otp"),
                    "challenge": bool(meta.get("challenge")), "message": meta.get("message", ""),
                    "waiting": bool(meta.get("waiting")),
                    "expires_in": max(0, int(TTL - (time.monotonic() - self.created)))}

    def act(self, payload):
        with self.lock:
            if self.closed:
                raise HTTPException(410, "Phiên kết nối đã đóng.")
            kind = payload.get("kind")
            if kind == "click":
                x, y = payload.get("x"), payload.get("y")
                if not valid_coordinates(x, y):
                    raise HTTPException(400, "Vị trí không hợp lệ.")
                for event in ("mousePressed", "mouseReleased"):
                    self.page.send("Input.dispatchMouseEvent", {
                        "type": event, "x": x, "y": y, "button": "left", "clickCount": 1,
                    })
            elif kind == "fill":
                index, value = payload.get("index"), payload.get("value")
                if not isinstance(index, int) or not isinstance(value, str) or len(value) > 2048:
                    raise HTTPException(400, "Nội dung không hợp lệ.")
                # Native setter keeps React-controlled fields in sync. Values are never logged.
                fingerprint = payload.get("fingerprint")
                if not isinstance(fingerprint, str) or len(fingerprint) > 4096:
                    raise HTTPException(400, "Ô nhập không hợp lệ.")
                result = self.page.js("""((i, value, fingerprint) => {
                  const el = document.querySelectorAll('input')[i];
                  if (!el || !['text','email','tel','password','number','search'].includes(el.type)) return false;
                  if (JSON.stringify([location.origin,i,el.type,el.name,el.id,el.placeholder,el.autocomplete]) !== fingerprint) return false;
                  el.focus();
                  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
                  el.dispatchEvent(new Event('input', {bubbles:true}));
                  el.dispatchEvent(new Event('change', {bubbles:true}));
                  return true;
                })(%s, %s, %s)""" % (index, json.dumps(value), json.dumps(fingerprint)))
                if not result:
                    raise HTTPException(409, "Màn hình đã đổi. Hãy chờ rồi nhập lại.")
                self._last_filled_fingerprint = fingerprint
                self._last_fill_at = time.monotonic()
            elif kind in ("advance", "resend", "back"):
                # Match actual sign-in controls rather than fixed screenshot coordinates.
                patterns = {
                    "advance": r"^(continue|next|log in|sign in|verify|confirm|tiếp tục|tiếp|đăng nhập|xác minh)$",
                    "resend": r"^(resend code|resend|gửi lại mã|gửi lại)$",
                    "back": r"^(back|go back|quay lại|trở lại)$",
                }
                result = None
                expected = payload.get("fingerprint") if kind == "advance" else None
                if not expected and kind == "advance" and time.monotonic() - getattr(self, "_last_fill_at", 0) < 15:
                    expected = getattr(self, "_last_filled_fingerprint", None)
                if expected is not None and (not isinstance(expected, str) or len(expected) > 4096):
                    raise HTTPException(400, "Ô nhập không hợp lệ.")
                for _ in range(10):
                    result = self.page.js("""((pattern, expected) => {
                      // Some OTP widgets submit immediately on the last digit.
                      // Do not click a control belonging to the next screen.
                      let expectedInput = null;
                      if (expected) {
                        const inputs = [...document.querySelectorAll('input')];
                        expectedInput = inputs.find((e,i) => JSON.stringify([location.origin,i,e.type,e.name,e.id,e.placeholder,e.autocomplete]) === expected);
                        if (!expectedInput) return 'progressed';
                      }
                      if (document.querySelector('textarea') && location.hostname === 'muse.ai') return 'progressed';
                      const re = new RegExp(pattern, 'i');
                      const buttons = [...document.querySelectorAll('button,[role="button"],a,input[type="submit"]')];
                      const el = buttons.find(e => {
                        const r = e.getBoundingClientRect();
                        return r.width > 0 && r.height > 0 && re.test((e.innerText || e.value || e.getAttribute('aria-label') || '').trim());
                      });
                      const otpPending = expectedInput && expectedInput.autocomplete.split(/\s+/).includes('one-time-code')
                        && expectedInput.maxLength >= 4 && expectedInput.value.length === expectedInput.maxLength
                        && ![...document.querySelectorAll('[role="alert"]')].some(e => e.innerText.trim());
                      if (!el) return otpPending ? 'pending' : 'missing';
                      if (el.disabled || el.getAttribute('aria-disabled') === 'true') return otpPending ? 'pending' : 'disabled';
                      el.click(); return 'clicked';
                    })(%s, %s)""" % (json.dumps(patterns[kind]), json.dumps(expected)))
                    if result in ("clicked", "progressed", "pending"):
                        break
                    time.sleep(.1)
                if result == "progressed":
                    return {"ok": True, "transitioned": True}
                if result == "pending":
                    return {"ok": True, "pending": True}
                if result != "clicked":
                    raise HTTPException(409, "Muse chưa cho tiếp tục. Kiểm tra thông tin hoặc mở màn hình Muse để xem yêu cầu.")
            elif kind == "enter":
                for event in ("keyDown", "keyUp"):
                    self.page.send("Input.dispatchKeyEvent", {
                        "type": event, "key": "Enter", "code": "Enter", "windowsVirtualKeyCode": 13,
                    })
            elif kind == "scroll":
                delta = payload.get("delta", 400)
                if not isinstance(delta, (int, float)) or not math.isfinite(delta):
                    raise HTTPException(400, "Thao tác không hợp lệ.")
                self.page.send("Input.dispatchMouseEvent", {
                    "type": "mouseWheel", "x": WIDTH / 2, "y": HEIGHT / 2,
                    "deltaX": 0, "deltaY": max(-HEIGHT, min(HEIGHT, delta)),
                })
            else:
                raise HTTPException(400, "Thao tác không được hỗ trợ.")


def register_login_routes(app, cfg, store, auth):
    sessions = {}
    registry_lock = threading.Lock()

    def discard(sid):
        with registry_lock:
            session = sessions.pop(sid, None)
        if session:
            session.close()

    def get(sid):
        with registry_lock:
            session = sessions.get(sid)
        if not session:
            raise HTTPException(410, "Phiên đã hết hạn. Hãy kết nối lại.")
        if time.monotonic() - session.created >= TTL:
            discard(sid)
            raise HTTPException(410, "Phiên đã hết hạn. Hãy kết nối lại.")
        return session

    @app.post("/admin/connect", dependencies=[Depends(auth)])
    def start(payload: dict = Body(...)):
        replace_id = payload.get("replace_id")
        if replace_id and (not isinstance(replace_id, str) or not store.get_account(replace_id)):
            raise HTTPException(404, "Không tìm thấy tài khoản cần thay.")
        # Keep startup under the registry lock so concurrent starts respect the limit.
        with registry_lock:
            if len(sessions) >= 2:
                raise HTTPException(429, "Đang có hai phiên đăng nhập. Hãy đóng một phiên rồi thử lại.")
            try:
                session = LoginSession(cfg, replace_id)
            except Exception:
                raise HTTPException(503, "Không mở được trình duyệt đăng nhập. Vui lòng thử lại.") from None
            sessions[session.id] = session
        timer = threading.Timer(TTL, discard, args=(session.id,))
        timer.daemon = True
        timer.start()
        return {"id": session.id, "expires_in": TTL}

    @app.get("/admin/connect/{sid}", dependencies=[Depends(auth)])
    def state(sid: str):
        return get(sid).state()

    @app.post("/admin/connect/{sid}/input", dependencies=[Depends(auth)])
    def action(sid: str, payload: dict = Body(...)):
        return get(sid).act(payload) or {"ok": True}

    @app.post("/admin/connect/{sid}/complete", dependencies=[Depends(auth)])
    def complete(sid: str, payload: dict = Body(...)):
        session = get(sid)
        with session.lock:
            if session.closed:
                raise HTTPException(410, "Phiên đã đóng.")
            session.engine.page = session.page
            live = session.engine.read_cookies()
            cookies = {k: v["value"] for k, v in live.items() if v.get("value")}
            expires = {k: v["expires"] for k, v in live.items() if v.get("expires", -1) > 0}
            if not all(cookies.get(k) for k in ESSENTIAL_COOKIES):
                raise HTTPException(409, "Chưa đăng nhập xong. Hãy hoàn tất bước đăng nhập hoặc xác minh.")
            try:
                session.engine._check_workspace(session.page)
                verified = session.engine.renew_session_http(cookies, expires, wake_vm=False)
            except MuseWorkspaceDisconnectedError:
                raise HTTPException(409, "Muse đã ngắt workspace này. Hãy gửi ticket tại muse.ai hoặc dùng tài khoản khác.") from None
            except MuseAuthError:
                raise HTTPException(409, "Muse chưa chấp nhận phiên đăng nhập. Hãy thử lại.") from None
            except Exception:
                raise HTTPException(502, "Chưa kiểm tra được phiên với Muse. Hãy thử lại sau.") from None
            label = str(payload.get("label", "")).strip()[:100]
            if session.replace_id:
                row = store.update_account(session.replace_id, cookies=verified["cookies"],
                    cookies_exp=verified["cookies_exp"], ok=True, enabled=True,
                    expiry_anchor=int(time.time()), note="Đã kết nối lại", **({"label": label} if label else {}))
                if not row:
                    raise HTTPException(404, "Tài khoản cần thay không còn tồn tại.")
            else:
                row = store.add_account(verified["cookies"], label, verified["cookies_exp"])
                store.mark(row["id"], True, "Đã xác minh phiên đăng nhập")
            store.update_account(row["id"], workspace_status="unknown", workspace_checked_at=0, workspace_note="")
            result = {"ok": True, "account": {"id": row["id"], "label": row["label"]}}
        discard(sid)
        return result

    @app.delete("/admin/connect/{sid}", dependencies=[Depends(auth)])
    def cancel(sid: str):
        discard(sid)
        return {"ok": True}

    @app.on_event("shutdown")
    def shutdown():
        for sid in list(sessions):
            discard(sid)

"""Offline regression for a workspace disconnect before or during chat submission."""
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from engine import MuseEngine, MuseGenerationError


BODY = ('Muse is disconnected\nWe disconnected Muse to protect your information. '
        'Submit a feedback ticket to reconnect.')


class WorkspaceTests(unittest.TestCase):
    def setUp(self):
        self.engine = object.__new__(MuseEngine)
        self.page = Mock()
        self.page.js.return_value = BODY
        self.engine.page = self.page

    def assert_disconnected(self, fn):
        with self.assertRaisesRegex(MuseGenerationError, 'feedback ticket'):
            fn()

    def test_cached_page_disconnect(self):
        self.assert_disconnected(lambda: self.engine.ensure_page({}))

    def test_disconnect_during_hydration(self):
        self.assert_disconnected(lambda: self.engine._wait_ws_ready(self.page))

    def test_disconnect_after_thread_reset_before_send(self):
        self.page.js.side_effect = [None, None, BODY]
        with patch('engine.time.sleep'):
            self.assert_disconnected(lambda: self.engine._send('test'))
        self.page.send.assert_not_called()

    def test_disconnect_while_loading_fresh_page(self):
        self.engine.page = None
        self.engine.cfg = SimpleNamespace(login_wait=1)
        with patch.object(self.engine, '_open_page', return_value=self.page), \
             patch.object(self.engine, '_apply_cookies'), \
             patch.object(self.engine, 'renew_session_http', return_value={}), \
             patch('engine.time.sleep'):
            self.assert_disconnected(lambda: self.engine.ensure_page({}))
        self.assertIs(self.engine.page, self.page)

    def test_normal_loading_is_not_a_restriction(self):
        self.page.js.return_value = 'Connecting...'
        self.engine._check_workspace(self.page)


if __name__ == '__main__':
    unittest.main()

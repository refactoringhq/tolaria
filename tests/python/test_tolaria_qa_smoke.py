import http.client
from unittest import TestCase
from unittest.mock import Mock, patch

from scripts.tolaria_qa_smoke import retry_webdriver_request


class WebDriverRetryTests(TestCase):
    def test_retries_a_dropped_response(self):
        request = Mock(side_effect=[http.client.RemoteDisconnected("driver busy"), "page body"])
        with patch("scripts.tolaria_qa_smoke.time.sleep"):
            self.assertEqual(retry_webdriver_request(request, "DOM read"), "page body")
        self.assertEqual(request.call_count, 2)

    def test_persistent_disconnect_fails_clearly(self):
        request = Mock(side_effect=http.client.RemoteDisconnected("driver stopped"))
        with patch("scripts.tolaria_qa_smoke.time.sleep"):
            with self.assertRaisesRegex(RuntimeError, "DOM read lost its WebDriver connection after 4 attempts"):
                retry_webdriver_request(request, "DOM read")
        self.assertEqual(request.call_count, 4)

    def test_non_transport_error_is_not_retried(self):
        request = Mock(side_effect=ValueError("invalid session"))
        with self.assertRaisesRegex(ValueError, "invalid session"):
            retry_webdriver_request(request, "DOM read")
        self.assertEqual(request.call_count, 1)


if __name__ == "__main__":
    import unittest

    unittest.main()

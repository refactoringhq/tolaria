"""Transient WebDriver transport recovery for Linux QA."""

import http.client
import time
import urllib.error


def retry_webdriver_request(request, action: str):
    """Retry transient driver transport drops without masking WebDriver errors."""
    last_error = None
    for attempt in range(4):
        try:
            return request()
        except (http.client.RemoteDisconnected, ConnectionError, TimeoutError) as error:
            last_error = error
        except urllib.error.URLError as error:
            if not isinstance(error.reason, (ConnectionError, TimeoutError)):
                raise
            last_error = error
        if attempt < 3:
            time.sleep(0.5 * (2**attempt))
    raise RuntimeError(f"{action} lost its WebDriver connection after 4 attempts: {last_error}") from last_error

#!/usr/bin/env python3
"""CDP probe v2 — 更深入"""
import json
import time
import urllib.request
import websocket

CDP_HTTP = "http://127.0.0.1:9222"
TARGET_URL = "http://localhost:5173/"


def get_ws_url():
    data = json.loads(urllib.request.urlopen(f"{CDP_HTTP}/json").read())
    for t in data:
        if t.get("type") == "page":
            return t["webSocketDebuggerUrl"]
    raise RuntimeError("no page target found")


def main():
    ws_url = get_ws_url()
    ws = websocket.create_connection(ws_url, timeout=30)
    msg_id = 0

    def send(method, params=None, wait=8):
        nonlocal msg_id
        msg_id += 1
        ws.send(json.dumps({"id": msg_id, "method": method, "params": params or {}}))
        ws.settimeout(wait)
        try:
            while True:
                raw = ws.recv()
                data = json.loads(raw)
                if data.get("id") == msg_id:
                    return data
        except Exception:
            return None

    console_msgs = []
    page_errors = []
    network_errors = []

    def listen_events(timeout=3):
        ws.settimeout(timeout)
        try:
            while True:
                raw = ws.recv()
                data = json.loads(raw)
                m = data.get("method", "")
                if m == "Runtime.consoleAPICalled":
                    args = data["params"].get("args", [])
                    text = " ".join(str(a.get("value", "")) for a in args)
                    console_msgs.append((data["params"].get("type", ""), text))
                elif m == "Runtime.exceptionThrown":
                    page_errors.append(data["params"].get("exceptionDetails", {}).get("text", ""))
                elif m == "Network.responseReceived":
                    resp = data["params"]["response"]
                    if resp["status"] >= 400:
                        network_errors.append(f"{resp['status']} {resp['url']}")
                elif m == "Network.loadingFailed":
                    network_errors.append(f"FAIL {data['params'].get('errorText', '')} {data['params'].get('request', {}).get('url', '')}")
        except Exception:
            pass

    send("Runtime.enable")
    send("Network.enable")
    send("Page.enable")
    send("Log.enable")

    print(f"Navigating to {TARGET_URL}")
    send("Page.navigate", {"url": TARGET_URL})
    listen_events(5)

    # Check rendered DOM
    result = send("Runtime.evaluate", {
        "expression": "JSON.stringify({ url: location.href, buttons: document.querySelectorAll('button').length, h1: document.querySelector('h1')?.textContent, h2s: Array.from(document.querySelectorAll('h2')).map(h => h.textContent), main: document.querySelector('main')?.textContent?.slice(0, 200) })",
        "returnByValue": True,
        "wait": 5
    })
    print("After load:", result.get("result", {}).get("value", "") if result else "TIMEOUT")

    # Check React mounted
    result = send("Runtime.evaluate", {
        "expression": "(() => { const root = document.getElementById('root'); return JSON.stringify({ hasRoot: !!root, childCount: root?.children?.length, firstChildTag: root?.firstElementChild?.tagName }) })()",
        "returnByValue": True,
        "wait": 3
    })
    print("React mount:", result.get("result", {}).get("value", "") if result else "TIMEOUT")

    # Try clicking weak mode
    click = send("Runtime.evaluate", {
        "expression": """(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          if (buttons.length === 0) return JSON.stringify({ error: 'no buttons', html: document.body.innerHTML.slice(0, 500) });
          return JSON.stringify({ total: buttons.length, first: buttons[0].textContent });
        })()""",
        "returnByValue": True,
        "wait": 3
    })
    print("Buttons check:", click.get("result", {}).get("value", "") if click else "TIMEOUT")

    listen_events(2)

    # Try webcam toggle in weak mode
    click2 = send("Runtime.evaluate", {
        "expression": """(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const result = buttons.slice(0, 5).map(b => b.textContent?.trim().slice(0, 20));
          return JSON.stringify(result);
        })()""",
        "returnByValue": True,
        "wait": 3
    })
    print("First 5 buttons:", click2.get("result", {}).get("value", "") if click2 else "TIMEOUT")

    # Try to click the "weak mode" entry
    click3 = send("Runtime.evaluate", {
        "expression": """(() => {
          const links = Array.from(document.querySelectorAll('button, [role=button]'));
          // Find any "弱模式" / "Low" / "Beginner" reference
          const weak = links.find(b => b.textContent?.match(/弱|Low|Beginner|🟢/));
          if (!weak) return 'not found';
          weak.click();
          return 'clicked: ' + weak.textContent?.slice(0, 30);
        })()""",
        "returnByValue": True,
        "wait": 3
    })
    print("Click weak mode:", click3.get("result", {}).get("value", "") if click3 else "TIMEOUT")

    listen_events(3)

    # Final state
    result = send("Runtime.evaluate", {
        "expression": "JSON.stringify({ buttons: document.querySelectorAll('button').length, h1: document.querySelector('h1')?.textContent, body: document.body.innerText.slice(0, 200) })",
        "returnByValue": True,
        "wait": 3
    })
    print("After click weak mode:", result.get("result", {}).get("value", "") if result else "TIMEOUT")

    # Final event collection
    listen_events(2)

    print(f"\n=== Console ({len(console_msgs)}) ===")
    for t, m in console_msgs[-30:]:
        print(f"  [{t}] {m[:200]}")

    print(f"\n=== Network errors ({len(network_errors)}) ===")
    for e in network_errors[:10]:
        print(f"  {e[:200]}")

    print(f"\n=== Page exceptions ({len(page_errors)}) ===")
    for e in page_errors[:5]:
        print(f"  {e[:200]}")

    ws.close()


if __name__ == "__main__":
    main()

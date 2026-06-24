import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def test_payload(name, payload):
    try:
        url = "https://paper-cut-apce.vercel.app/api/user/wallet"
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url, 
            data=data, 
            headers={'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'}
        )
        print(f"\n--- Testing: {name} ---")
        with urllib.request.urlopen(req, timeout=10, context=ctx) as response:
            print("Status:", response.status)
            print("Response:", response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        print("HTTP Error:", e.code)
        print("HTTP Error Response:", e.read().decode('utf-8'))
    except Exception as e:
        print("Connection failed:", e)

# Test 1: Simulating cached mock wallet
test_payload("Mock Wallet Cache Restoration", {
    "email": "daveynfts@gmail.com",
    "walletId": "3a6e2518-58af-5c75-bfef-27d94abfb6a2",
    "address": "0x8b0d5e85cd76004707de122ed01e37b44254bce8",
    "isMock": True
})

# Test 2: Simulating no cache
test_payload("Clean Request (No Cache)", {
    "email": "daveynfts@gmail.com"
})

import urllib.request
import re
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def check_url(url):
    try:
        print(f"Fetching URL: {url}")
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10, context=ctx) as r:
            html = r.read().decode('utf-8')
            print(f"Loaded successfully. Length: {len(html)}")
            # Print first 200 chars
            print("Preview:", html[:200])
            
            # Find script tags
            js_files = re.findall(r'src="([^"]+\.js)"', html)
            if not js_files:
                js_files = re.findall(r'href="([^"]+\.js)"', html)
            print("JS Files:", js_files)
            
            for js_rel in js_files:
                if js_rel.startswith('/'):
                    js_url = "/".join(url.split('/')[:3]) + js_rel
                elif js_rel.startswith('http'):
                    js_url = js_rel
                else:
                    js_url = url + js_rel
                    
                print(f"Checking JS content at: {js_url}")
                try:
                    js_req = urllib.request.Request(js_url, headers={'User-Agent': 'Mozilla/5.0'})
                    with urllib.request.urlopen(js_req, timeout=10, context=ctx) as js_r:
                        js_content = js_r.read().decode('utf-8')
                        if "paper-cut-apce.vercel.app" in js_content:
                            print("-> SUCCESS: Found 'paper-cut-apce.vercel.app'!")
                            if "isLocalHost" in js_content:
                                print("-> SUCCESS: Found 'isLocalHost' bypass check!")
                            else:
                                print("-> WARNING: 'isLocalHost' not found in JS.")
                        else:
                            print("-> WARNING: 'paper-cut-apce.vercel.app' not found.")
                except Exception as e:
                    print("Failed to fetch JS file:", e)
    except Exception as e:
        print("Failed to fetch page:", e)

print("--- Checking Root ---")
check_url("https://papercut.vercel.app/")
print("\n--- Checking Subpath ---")
check_url("https://papercut.vercel.app/papercut")

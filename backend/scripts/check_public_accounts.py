"""Verify public HTTPS account/session persistence with a generated QA identity."""
import argparse
import secrets
import httpx

def check(url):
    username="qa_"+secrets.token_hex(5)
    password=secrets.token_urlsafe(24)
    with httpx.Client(base_url=url,timeout=45) as api:
        response=api.post("/api/auth/register",json={"username":username,"password":password,"display_name":"Night Watch","avatar_color":4,"hat":"cap"})
        response.raise_for_status();identity=response.json()
        cookie=response.headers["set-cookie"].lower()
        assert "httponly" in cookie and "secure" in cookie and "samesite=lax" in cookie
        assert "password_hash" not in identity
        assert api.get("/api/auth/me").json()["account"]["id"]==identity["id"]
        response=api.post("/api/auth/profile",json={"display_name":"Night Watch","avatar_color":1,"hat":"beanie"})
        response.raise_for_status()
        assert response.json()["hat"]=="beanie"
        api.post("/api/auth/logout").raise_for_status()
        assert api.get("/api/auth/me").json()["account"] is None
        api.post("/api/auth/login",json={"username":username,"password":password}).raise_for_status()
        assert api.get("/api/auth/me").json()["account"]["avatar_color"]==1
        api.post("/api/auth/logout").raise_for_status()
    print("HTTPS registration, secure cookie, saved profile, sign-out, and sign-in verified.")

if __name__=="__main__":
    parser=argparse.ArgumentParser();parser.add_argument("--url",required=True)
    check(parser.parse_args().url.rstrip("/"))

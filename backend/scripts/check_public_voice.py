"""Exercise hosted room voice with synthetic audio; never accesses a microphone."""
import argparse
import asyncio
import json
import math
import struct
import httpx
from websockets.asyncio.client import connect

async def check(url):
    async with httpx.AsyncClient(base_url=url,timeout=30) as api:
        maps=(await api.get("/api/maps")).json()["maps"]
        assert {item["id"] for item in maps}=={"campus","observatory","ferry"}
        response=await api.post("/api/rooms",json={"name":"Voice Sender","map_id":"ferry"})
        response.raise_for_status();host=response.json()
        response=await api.post(f"/api/rooms/{host['room_code']}/join",json={"name":"Voice Listener"})
        response.raise_for_status();guest=response.json()
        endpoint=lambda session:f"{url.replace('http','ws',1)}/ws/voice/{session['room_code']}?player_id={session['player_id']}&token={session['reconnect_token']}"
        async with connect(endpoint(host)) as sender:
            assert len(json.loads(await sender.recv())["players"])==1
            async with connect(endpoint(guest)) as listener:
                assert len(json.loads(await listener.recv())["players"])==2
                assert len(json.loads(await sender.recv())["players"])==2
                frame=struct.pack('<640h',*(int(math.sin(2*math.pi*440*i/16000)*3000) for i in range(640)))
                for _ in range(5):
                    await sender.send(frame)
                    assert await asyncio.wait_for(listener.recv(),3)==b'\x00'+frame
                    await listener.send(frame)
                    assert await asyncio.wait_for(sender.recv(),3)==b'\x01'+frame
                    await asyncio.sleep(.04)
            assert len(json.loads(await sender.recv())["players"])==1
        snapshot=(await api.get(f"/api/rooms/{host['room_code']}")).json()
        assert snapshot["room"]["map_id"]=="ferry"
        assert not snapshot["chat"] and not snapshot["evidence"]
        print("Three public maps and bidirectional authenticated voice frames verified over TLS; no microphone used.")

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--url',required=True)
    asyncio.run(check(parser.parse_args().url.rstrip('/')))

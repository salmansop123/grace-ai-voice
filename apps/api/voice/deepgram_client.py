import websockets


async def open_deepgram_socket(api_key: str) -> websockets.WebSocketClientProtocol:
    url = (
        "wss://api.deepgram.com/v1/listen"
        "?model=nova-2"
        "&encoding=mulaw"
        "&sample_rate=8000"
        "&channels=1"
        "&punctuate=true"
        "&endpointing=300"
        "&utterance_end_ms=1000"
        "&interim_results=false"
    )
    headers = {"Authorization": f"Token {api_key}"}
    return await websockets.connect(url, extra_headers=headers)
async def connect_deepgram() -> None:
    return None

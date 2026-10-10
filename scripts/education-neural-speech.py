"""Generate authored public education narration using edge-tts 7.2.8.

Only the supplied script text is sent to the speech service. Output MP3 and
sentence subtitle files are production assets; no service is used in playback.
"""
import argparse
import asyncio
import json
import pathlib
import edge_tts


async def synthesize(job, voice):
    output = pathlib.Path(job['output'])
    output.parent.mkdir(parents=True, exist_ok=True)
    subtitles = output.with_suffix('.jsonl')
    if output.exists() and subtitles.exists() and output.stat().st_size > 1000:
        boundaries = [json.loads(line)['text'] for line in subtitles.read_text(encoding='utf-8').splitlines() if line]
        if ''.join(boundaries) == job['text']:
            return
    for attempt in range(3):
        try:
            communication = edge_tts.Communicate(
                job['text'], voice, rate='-8%', pitch='+0Hz',
                boundary='SentenceBoundary', connect_timeout=15, receive_timeout=45,
            )
            await communication.save(str(output), str(subtitles))
            print(json.dumps({'output': output.name, 'bytes': output.stat().st_size}, ensure_ascii=False), flush=True)
            return
        except Exception:
            if attempt == 2:
                raise
            await asyncio.sleep(1 + attempt)


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('jobs')
    parser.add_argument('--voice', default='zh-CN-XiaoxiaoNeural')
    args = parser.parse_args()
    jobs = json.loads(pathlib.Path(args.jobs).read_text(encoding='utf-8'))
    semaphore = asyncio.Semaphore(3)
    async def bounded(job):
        async with semaphore:
            await synthesize(job, args.voice)
    await asyncio.gather(*(bounded(job) for job in jobs))


if __name__ == '__main__':
    asyncio.run(main())

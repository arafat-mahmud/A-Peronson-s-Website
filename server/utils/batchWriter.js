// Write-behind batching for rows nothing reads back immediately (analytics).
//
// `add(row)` returns at once; rows are written with one `write(rows)` call per
// batch - after `intervalMs`, or as soon as `batchSize` rows are waiting. A
// failed batch is put back once (bounded by `maxBuffered`) and retried later.
// `flush()` writes everything now (graceful shutdown).

export function createBatchWriter({
	write,
	onError = () => {},
	intervalMs = 1000,
	batchSize = 100,
	maxBuffered = 5000,
	retryDelayMs = 10_000,
}) {
	const buffer = [];
	let timer = null;
	let flushing = null;

	function schedule(delay) {
		if (timer) return;
		timer = setTimeout(() => {
			timer = null;
			void flush();
		}, delay);
		timer.unref?.();
	}

	function flush() {
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
		if (flushing) return flushing;
		flushing = (async () => {
			while (buffer.length > 0) {
				const batch = buffer.splice(0, batchSize);
				try {
					await write(batch);
				} catch (error) {
					if (buffer.length + batch.length <= maxBuffered) buffer.unshift(...batch);
					onError(error, batch.length);
					schedule(retryDelayMs);
					break;
				}
			}
		})().finally(() => {
			flushing = null;
		});
		return flushing;
	}

	function add(row) {
		if (buffer.length >= maxBuffered) buffer.shift();
		buffer.push(row);
		if (buffer.length >= batchSize) void flush();
		else schedule(intervalMs);
	}

	return { add, flush, size: () => buffer.length };
}

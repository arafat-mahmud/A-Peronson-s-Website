import { API_BASE, getToken } from "./auth.js";

export function uploadFile(path, { file, fields = {}, token = getToken(), onProgress }) {
	return new Promise((resolve, reject) => {
		const formData = new FormData();
		formData.append("file", file);
		for (const [key, value] of Object.entries(fields)) {
			if (value !== undefined && value !== null) {
				formData.append(key, value);
			}
		}

		const xhr = new XMLHttpRequest();
		xhr.open("POST", `${API_BASE}${path}`);

		if (token) {
			xhr.setRequestHeader("Authorization", `Bearer ${token}`);
		}

		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable && onProgress) {
				onProgress(Math.round((e.loaded / e.total) * 100));
			}
		};

		xhr.onload = () => {
			try {
				const data = JSON.parse(xhr.responseText);
				if (xhr.status >= 200 && xhr.status < 300) {
					resolve(data);
				} else {
					const error = new Error(data.error || "Upload failed");
					error.status = xhr.status;
					error.details = data;
					reject(error);
				}
			} catch {
				reject(new Error("Invalid response from server"));
			}
		};

		xhr.onerror = () => reject(new Error("Network error"));
		xhr.onabort = () => reject(new Error("Upload cancelled"));
		xhr.send(formData);
	});
}

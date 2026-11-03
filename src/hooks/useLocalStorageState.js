import { useCallback, useEffect, useMemo, useState } from "react";

function safeParseJson(value, fallback) {
	if (value === null || value === undefined || value === "") {
		return fallback;
	}
	try {
		return JSON.parse(value);
	} catch {
		return fallback;
	}
}

/**
 * Hook to manage state synchronized with localStorage.
 * @param {string} key - The localStorage key.
 * @param {*} initialValue - The initial value.
 * @returns {[*, Function]} State value and setter function.
 */
export default function useLocalStorageState(key, initialValue) {
	const initial = useMemo(() => {
		if (!key) {
			return initialValue;
		}
		return safeParseJson(window.localStorage.getItem(key), initialValue);
	}, [initialValue, key]);

	const [value, setValue] = useState(initial);

	useEffect(() => {
		if (!key) {
			return;
		}
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setValue(safeParseJson(window.localStorage.getItem(key), initialValue));
	}, [initialValue, key]);

	const setAndPersist = useCallback(
		(nextValue) => {
			setValue((previous) => {
				const resolved = typeof nextValue === "function" ? nextValue(previous) : nextValue;
				if (key) {
					window.localStorage.setItem(key, JSON.stringify(resolved));
				}
				return resolved;
			});
		},
		[key],
	);

	return [value, setAndPersist];
}

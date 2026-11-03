import blessed from "blessed";
import { COLORS } from "./theme.js";

export class ContextMenu extends blessed.box {
	constructor(options) {
		super({
			...options,
			hidden: true,
			width: 24,
			height: 12,
			tags: true,
			mouse: true,
			keys: true,
			style: {
				bg: COLORS.card,
				border: { type: "line", fg: COLORS.accent },
			},
			border: { type: "line", fg: COLORS.accent },
			label: " ▸ actions ",
		});
		this.items = [];
		this.onAction = null;
		this.selectedIndex = 0;
		this.on("click", (data) => {
			const y = Math.floor(data.y - this.top - 1);
			if (y >= 0 && y < this.items.length) {
				this.choose(y);
			}
		});
		this.on("mouse", (data) => {
			if (data.action === "wheelup") {
				this.move(-1);
			}
			if (data.action === "wheeldown") {
				this.move(1);
			}
		});
	}

	open(x, y, items) {
		this.items = items || [];
		this.selectedIndex = 0;
		this.setPosition({
			left: Math.min(x, this.screen?.width - this.width),
			top: Math.min(y, this.screen?.height - this.height),
		});
		this.height = Math.max(2, this.items.length + 2);
		this.draw();
		this.show();
		this.focus();
		this.screen?.render();
	}

	move(delta) {
		if (!this.items.length) {
			return;
		}
		this.selectedIndex = (this.selectedIndex + delta + this.items.length) % this.items.length;
		this.draw();
		this.screen?.render();
	}

	choose(idx) {
		const item = this.items[idx];
		if (item) {
			this.hide();
			this.onAction?.(item.key, idx);
		}
	}

	draw() {
		const lines = [];
		this.items.forEach((item, i) => {
			const icon = item.icon || "•";
			const sel = i === this.selectedIndex;
			const line = sel
				? `{blue-bg}{black-fg} ${icon} ${item.label}{/black-fg}{/blue-bg}`
				: ` ${icon} {#E2E8F0-fg}${item.label}{/}`;
			lines.push(line);
		});
		this.setContent(lines.join("\n"));
	}

	handleKey(name) {
		if (name === "up") {
			this.move(-1);
		} else if (name === "down") {
			this.move(1);
		} else if (name === "enter") {
			this.choose(this.selectedIndex);
		} else if (name === "escape") {
			this.hide();
			this.screen?.render();
		}
	}
}

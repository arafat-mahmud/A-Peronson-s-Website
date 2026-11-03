import remarkAbbr from "@syenchuk/remark-abbr";
import { lazy, memo, Suspense, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkDeflist from "remark-deflist";
import remarkDirective from "remark-directive";
import remarkEmoji from "remark-emoji";
import remarkGfm from "remark-gfm";
import { remarkHighlightMark } from "remark-highlight-mark";
import remarkIns from "remark-ins";
import remarkSmartypants from "remark-smartypants";
import remarkSupersub from "remark-supersub";
import remarkContainerDirective from "../../lib/remarkContainerDirective.js";
import LazyImage from "../ui/LazyImage.jsx";

// Prism is ~280 KB; load it only when a message actually contains a fenced code block.
const CodeBlock = lazy(() => import("../ui/CodeBlock.jsx"));

const EXTRA_ALLOWED_TAGS = ["sub", "sup", "ins", "details", "summary", "kbd", "mark", "input"];

function MarkdownMessage({ text = "" }) {
	const value = String(text || "");
	const trimmed = value.trim();
	const schema = useMemo(() => {
		const base = defaultSchema || {};
		return {
			...base,
			tagNames: Array.from(
				new Set([
					...(base.tagNames || []),
					...EXTRA_ALLOWED_TAGS,
					"ins",
					"mark",
					"sup",
					"sub",
					"abbr",
					"dl",
					"dt",
					"dd",
				]),
			),
			attributes: {
				...(base.attributes || {}),
				a: Array.from(new Set([...(base.attributes?.a || []), "target", "rel"])),
				img: Array.from(new Set([...(base.attributes?.img || []), "src", "alt", "title"])),
				code: Array.from(new Set([...(base.attributes?.code || []), "className"])),
				details: Array.from(new Set([...(base.attributes?.details || []), "open"])),
				input: Array.from(
					new Set([...(base.attributes?.input || []), "type", "checked", "disabled"]),
				),
			},
		};
	}, []);

	if (!trimmed) {
		return null;
	}

	return (
		<div class="break-words text-[13px] leading-[1.45] text-inherit">
			<ReactMarkdown
				remarkPlugins={[
					[remarkGfm, { singleTilde: false }],
					remarkSmartypants,
					remarkEmoji,
					remarkSupersub,
					remarkIns,
					remarkHighlightMark,
					remarkDeflist,
					remarkDirective,
					remarkContainerDirective,
					remarkAbbr,
				]}
				rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
				components={{
					a({ href = "", className = "", ...props }) {
						const external = /^https*:\/\//i.test(String(href || ""));
						return (
							<a
								{...props}
								href={href}
								target={external ? "_blank" : props.target}
								rel={external ? "noreferrer noopener" : props.rel}
								class={`underline underline-offset-2 ${className}`.trim()}
							/>
						);
					},
					p({ className = "", ...props }) {
						return <p {...props} class={`my-1 ${className}`.trim()} />;
					},
					blockquote({ className = "", ...props }) {
						return (
							<blockquote
								{...props}
								class={[
									"my-1 pl-3",
									"shadow-[inset_3px_0_0_rgba(148,163,184,0.75)] dark:shadow-[inset_3px_0_0_rgba(255,255,255,0.12)]",
									"opacity-95",
									className,
								]
									.join(" ")
									.trim()}
							/>
						);
					},
					pre({ className = "", ...props }) {
						return (
							<pre
								{...props}
								class={[
									"my-1 overflow-x-auto rounded-xl bg-[var(--theme-custom-0b1020)] p-3 text-slate-100",
									"dark:bg-black/35",
									className,
								]
									.join(" ")
									.trim()}
							/>
						);
					},
					code({ inline = false, className = "", children, ...props }) {
						if (inline) {
							return (
								<code
									{...props}
									class={[
										"rounded bg-slate-900/5 px-1 py-0.5 font-mono text-[0.92em]",
										"dark:bg-black/35",
										className,
									]
										.join(" ")
										.trim()}
								/>
							);
						}
						return (
							<Suspense fallback={<code className={className}>{children}</code>}>
								<CodeBlock className={className} {...props}>
									{children}
								</CodeBlock>
							</Suspense>
						);
					},
					table({ className = "", ...props }) {
						return (
							<table
								{...props}
								class={`my-2 w-full border-collapse text-[12px] ${className}`.trim()}
							/>
						);
					},
					th({ className = "", ...props }) {
						return (
							<th
								{...props}
								class={[
									"bg-slate-900/5 font-bold",
									"shadow-[inset_0_0_0_1px_rgba(148,163,184,0.35)] dark:bg-white/5 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]",
									"px-2 py-1 text-left align-top",
									className,
								]
									.join(" ")
									.trim()}
							/>
						);
					},
					td({ className = "", ...props }) {
						return (
							<td
								{...props}
								class={[
									"shadow-[inset_0_0_0_1px_rgba(148,163,184,0.35)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]",
									"px-2 py-1 align-top",
									className,
								]
									.join(" ")
									.trim()}
							/>
						);
					},
					img({ className = "", ...props }) {
						return (
							<LazyImage
								{...props}
								width={600}
								height={400}
								class={`max-w-full rounded-xl shadow-borderless dark:shadow-borderlessDark ${className}`.trim()}
							/>
						);
					},
					input({ type = "checkbox", checked = false, ...props }) {
						return (
							<input
								{...props}
								type={type}
								checked={Boolean(checked)}
								disabled={true}
								readOnly={true}
								class="mr-2 align-middle accent-gtBlue"
							/>
						);
					},
				}}
			>
				{value}
			</ReactMarkdown>
		</div>
	);
}

export default memo(MarkdownMessage);

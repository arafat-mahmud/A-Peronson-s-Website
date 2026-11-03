import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

export default function CodeBlock({ className, children, ...props }) {
	const match = /language-(\w+)/.exec(className || "");
	const language = match ? match[1] : "";
	const code = String(children || "").replace(/\n$/, "");

	if (!language) {
		return (
			<code className={className} {...props}>
				{children}
			</code>
		);
	}

	return (
		<SyntaxHighlighter
			language={language}
			style={oneDark}
			PreTag="div"
			customStyle={{
				borderRadius: "1rem",
				padding: "1.25rem",
				fontSize: "0.875rem",
				lineHeight: "1.6",
				margin: "0.75rem 0",
			}}
		>
			{code}
		</SyntaxHighlighter>
	);
}

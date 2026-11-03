export default function remarkContainerDirective() {
	return (tree) => {
		function walk(node) {
			if (!node || typeof node !== "object") {
				return;
			}
			if (node.type === "containerDirective" || node.type === "leafDirective") {
				const data = node.data || (node.data = {});
				data.hName = "div";
				data.hProperties = {
					className: `directive directive-${node.name} border-l-4 pl-4 py-3 my-4 rounded bg-slate-800/30 border-sky-500`,
				};
			}
			if (node.children) {
				node.children.forEach(walk);
			}
		}
		walk(tree);
	};
}

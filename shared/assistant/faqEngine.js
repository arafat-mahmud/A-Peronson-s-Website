// Deterministic FAQ answers for the floating assistant.
//
// Used when the AI provider is unavailable (or the visitor is not signed in)
// so the assistant still answers the common questions (client 02/11/2026:
// "the bot is 100% useless - it must answer normal questions"). Token-based
// phrase scoring over English, Bangla and Banglish; no network, no data
// lookups, and an honest "I didn't understand" instead of a made-up answer.

const SUPPORT_EMAIL = "gartexhubsupport@gmail.com";

const SIGNUP_WORDS = [
	"register",
	"registration",
	"signup",
	"sign up",
	"join",
	"account",
	"create",
	"রেজিস্ট্রেশন",
	"নিবন্ধন",
	"অ্যাকাউন্ট",
];

const INTENTS = [
	{
		id: "greeting",
		keywords: [
			"hi",
			"hello",
			"hey",
			"salam",
			"assalamu",
			"assalamualaikum",
			"হ্যালো",
			"হাই",
			"আসসালামু",
			"সালাম",
		],
		link: null,
		en: "Hello! I can help with GarTexHub accounts, verification, products, buyer requirements, search, messaging and plans. What would you like to know?",
		bn: "হ্যালো! GarTexHub-এর অ্যাকাউন্ট, ভেরিফিকেশন, প্রোডাক্ট, বায়ার রিকোয়ারমেন্ট, সার্চ, মেসেজিং ও প্ল্যান নিয়ে সাহায্য করতে পারি। কী জানতে চান?",
	},
	{
		id: "what_is",
		keywords: [
			"what is gartexhub",
			"about gartexhub",
			"gartexhub ki",
			"what do you do",
			"what is this",
			"গারটেক্সহাব কী",
			"গারটেক্সহাব কি",
			"এটা কী",
			"এটা কি",
			"সম্পর্কে",
		],
		link: { to: "/about", label: "About GarTexHub" },
		en: "GarTexHub is a B2B sourcing marketplace for garments and textiles. International buyers, garment factories, textile mills and buying houses find each other, post sourcing requirements, show products and capacity, talk directly and keep contracts in one place.",
		bn: "GarTexHub হলো গার্মেন্টস ও টেক্সটাইলের B2B সোর্সিং মার্কেটপ্লেস। এখানে বায়ার, গার্মেন্টস ফ্যাক্টরি, টেক্সটাইল মিল ও বায়িং হাউজ একে অপরকে খুঁজে পায়, রিকোয়ারমেন্ট পোস্ট করে, প্রোডাক্ট ও ক্যাপাসিটি দেখায়, সরাসরি কথা বলে এবং কন্ট্রাক্ট এক জায়গায় রাখে।",
	},
	{
		id: "who_can_use",
		keywords: [
			"who can use",
			"who can join",
			"account types",
			"account type",
			"kara use",
			"কারা ব্যবহার",
			"কে ব্যবহার",
			"কারা যোগ",
			"অ্যাকাউন্টের ধরন",
		],
		link: { to: "/signup", label: "Create an account" },
		en: "Three kinds of companies join: Buyers (brands, retailers, importers), Factories (Garments Industry or Textile Industry) and Buying Houses. Agents work inside a company account created by its owner.",
		bn: "তিন ধরনের প্রতিষ্ঠান যোগ দিতে পারে: বায়ার (ব্র্যান্ড, রিটেইলার, ইমপোর্টার), ফ্যাক্টরি (গার্মেন্টস বা টেক্সটাইল ইন্ডাস্ট্রি) এবং বায়িং হাউজ। এজেন্টরা প্রতিষ্ঠানের মালিকের তৈরি অ্যাকাউন্টের অধীনে কাজ করেন।",
	},
	{
		id: "buyer_signup",
		keywords: [
			"buyer account",
			"register as buyer",
			"sign up as buyer",
			"buyer signup",
			"buyer hisebe",
			"বায়ার অ্যাকাউন্ট",
			"বায়ার হিসেবে",
			"ক্রেতা অ্যাকাউন্ট",
			"ক্রেতা হিসেবে",
		],
		combos: [[["buyer", "বায়ার", "ক্রেতা"], SIGNUP_WORDS]],
		link: { to: "/signup", label: "Create a buyer account" },
		en: 'Open Create account, choose Account Type "Buyer", then enter your name, email, password, organization name, industry, country and position. A short onboarding follows; other details can be added later.',
		bn: 'Create account-এ গিয়ে Account Type "Buyer" বেছে নিন, তারপর নাম, ইমেইল, পাসওয়ার্ড, প্রতিষ্ঠানের নাম, ইন্ডাস্ট্রি, দেশ ও পদবি দিন। এরপর ছোট একটি অনবোর্ডিং; বাকি তথ্য পরে যোগ করা যায়।',
	},
	{
		id: "factory_signup",
		keywords: [
			"factory account",
			"register factory",
			"register as factory",
			"factory signup",
			"factory registration",
			"add my factory",
			"ফ্যাক্টরি রেজিস্ট্রেশন",
			"ফ্যাক্টরি অ্যাকাউন্ট",
			"কারখানা নিবন্ধন",
			"ফ্যাক্টরি হিসেবে",
		],
		combos: [[["factory", "mill", "manufacturer", "ফ্যাক্টরি", "কারখানা"], SIGNUP_WORDS]],
		link: { to: "/signup", label: "Register a factory" },
		en: 'Open Create account and choose "Factory". Pick Garments Industry or Textile Industry, add your number of employees and production capacity (quantity, a unit such as pieces or meters, and per day, week or month). Certifications can be added in onboarding or skipped for later.',
		bn: 'Create account-এ "Factory" বেছে নিন। গার্মেন্টস বা টেক্সটাইল ইন্ডাস্ট্রি নির্বাচন করুন, কর্মী সংখ্যা ও প্রোডাকশন ক্যাপাসিটি (পরিমাণ, একক যেমন পিস বা মিটার, এবং দিন/সপ্তাহ/মাস) দিন। সার্টিফিকেট অনবোর্ডিংয়ে দিতে পারেন বা পরে যোগ করতে পারেন।',
	},
	{
		id: "buying_house",
		keywords: ["buying house", "buyinghouse", "বায়িং হাউজ", "বায়িং হাউস"],
		link: { to: "/help", label: "Help Center" },
		en: "A buying house sources on behalf of buyers and works with partner factories. On GarTexHub a buying house connects with factories through Partner Network, handles buyer requests and manages its team members.",
		bn: "বায়িং হাউজ বায়ারদের পক্ষে সোর্সিং করে এবং পার্টনার ফ্যাক্টরির সাথে কাজ করে। GarTexHub-এ বায়িং হাউজ Partner Network দিয়ে ফ্যাক্টরির সাথে যুক্ত হয়, বায়ার রিকোয়েস্ট সামলায় এবং টিম মেম্বার পরিচালনা করে।",
	},
	{
		id: "company_profile",
		keywords: [
			"company profile",
			"my profile",
			"edit profile",
			"update profile",
			"profile update",
			"organization name",
			"company name",
			"প্রোফাইল",
			"প্রতিষ্ঠানের নাম",
			"নাম পরিবর্তন",
		],
		combos: [
			[
				["change", "edit", "update", "rename"],
				["name", "profile", "company", "organization", "logo", "banner"],
			],
		],
		link: { to: "/settings?tab=profile", label: "Edit my profile" },
		en: "Open My Profile from the menu and use Edit to update the organization name, industry, country, description and images; factories can also update production capacity. The organization name can be changed once every 90 days, and verified companies change it through re-verification.",
		bn: "মেনু থেকে My Profile খুলে Edit দিয়ে প্রতিষ্ঠানের নাম, ইন্ডাস্ট্রি, দেশ, বিবরণ ও ছবি আপডেট করুন; ফ্যাক্টরি প্রোডাকশন ক্যাপাসিটিও আপডেট করতে পারে। প্রতিষ্ঠানের নাম ৯০ দিনে একবার বদলানো যায়, আর ভেরিফায়েড প্রতিষ্ঠানের নাম বদলাতে আবার ভেরিফিকেশন লাগে।",
	},
	{
		id: "verification",
		keywords: [
			"verify",
			"verification",
			"verified",
			"badge",
			"documents",
			"trade license",
			"kivabe verify",
			"ভেরিফিকেশন",
			"ভেরিফাই",
			"যাচাই",
			"ডকুমেন্ট",
			"ট্রেড লাইসেন্স",
		],
		link: { to: "/verification", label: "Start verification" },
		en: "Verification is document-based. Factories submit company registration, trade license, TIN, the authorized person's NID, bank proof and ERC; buying houses the same without ERC; EU/USA buyers submit business registration, VAT or EIN, EORI or IOR and bank proof. The full standards are in the Help Center under Verification.",
		bn: "ভেরিফিকেশন ডকুমেন্টভিত্তিক। ফ্যাক্টরি দেয়: কোম্পানি রেজিস্ট্রেশন, ট্রেড লাইসেন্স, TIN, অনুমোদিত ব্যক্তির NID, ব্যাংক প্রুফ ও ERC; বায়িং হাউজ একই (ERC ছাড়া); EU/USA বায়ার দেয় বিজনেস রেজিস্ট্রেশন, VAT বা EIN, EORI বা IOR ও ব্যাংক প্রুফ। পূর্ণ মানদণ্ড Help Center-এর Verification অংশে আছে।",
	},
	{
		id: "products",
		keywords: [
			"publish product",
			"add product",
			"list product",
			"upload product",
			"my products",
			"product listing",
			"প্রোডাক্ট আপলোড",
			"পণ্য যোগ",
		],
		combos: [
			[
				["product", "item", "প্রোডাক্ট", "পণ্য"],
				["add", "list", "publish", "upload", "post", "create", "sell", "আপলোড", "যোগ", "পাবলিশ"],
			],
		],
		link: { to: "/product-management", label: "Manage products" },
		en: "Factories and buying houses publish products from Products in the menu: add a title, category, images or video, MOQ and lead time, then publish. Published products appear on your company profile and in search.",
		bn: "ফ্যাক্টরি ও বায়িং হাউজ মেনুর Products থেকে প্রোডাক্ট পাবলিশ করে: টাইটেল, ক্যাটাগরি, ছবি বা ভিডিও, MOQ ও লিড টাইম দিয়ে পাবলিশ করুন। পাবলিশ করা প্রোডাক্ট আপনার প্রোফাইল ও সার্চে দেখা যায়।",
	},
	{
		id: "buyer_requests",
		keywords: [
			"buyer request",
			"post requirement",
			"requirement",
			"rfq",
			"sourcing request",
			"post request",
			"রিকোয়ারমেন্ট",
			"রিকোয়েস্ট",
			"চাহিদা",
			"অর্ডার পোস্ট",
		],
		link: { to: "/buyer-requests", label: "Buyer requests" },
		en: "Buyers post sourcing requirements from Requests in the menu: describe the product, quantity, budget and deadline. Suppliers in the matching category can see the request and respond.",
		bn: "বায়ার মেনুর Requests থেকে রিকোয়ারমেন্ট পোস্ট করেন: প্রোডাক্ট, পরিমাণ, বাজেট ও ডেডলাইন লিখুন। সংশ্লিষ্ট ক্যাটাগরির সাপ্লায়াররা রিকোয়েস্ট দেখে সাড়া দিতে পারে।",
	},
	{
		id: "search",
		keywords: [
			"search",
			"find factory",
			"find supplier",
			"find buyer",
			"filter",
			"marketplace",
			"khujbo",
			"সার্চ",
			"খুঁজ",
			"ফিল্টার",
			"সাপ্লায়ার",
		],
		combos: [
			[
				["find", "look", "discover", "khuji", "খুঁজি"],
				["factory", "supplier", "manufacturer", "buyer", "company", "mill", "ফ্যাক্টরি", "সাপ্লায়ার"],
			],
		],
		link: { to: "/search", label: "Open search" },
		en: "Use Search (the magnifier in the top bar) to find companies, products and buyer requests, and narrow results with filters such as Garments or Textile category, country and verification.",
		bn: "উপরের বারের সার্চ (ম্যাগনিফায়ার) দিয়ে প্রতিষ্ঠান, প্রোডাক্ট ও বায়ার রিকোয়েস্ট খুঁজুন; গার্মেন্টস/টেক্সটাইল ক্যাটাগরি, দেশ ও ভেরিফিকেশন ফিল্টার ব্যবহার করুন।",
	},
	{
		id: "messaging",
		keywords: [
			"message",
			"messaging",
			"chat",
			"contact supplier",
			"contact buyer",
			"send message",
			"call",
			"মেসেজ",
			"চ্যাট",
			"যোগাযোগ",
			"বার্তা",
			"কল",
		],
		link: { to: "/chat", label: "Open chat" },
		en: "Open a company's profile and press Contact or Send Message, or go to Chat in the menu. Messages from verified accounts go straight to the inbox; voice and video calls start from a conversation.",
		bn: "কোনো প্রতিষ্ঠানের প্রোফাইলে Contact বা Send Message চাপুন, অথবা মেনুর Chat-এ যান। ভেরিফায়েড অ্যাকাউন্টের মেসেজ সরাসরি ইনবক্সে যায়; কনভারসেশন থেকে ভয়েস ও ভিডিও কল করা যায়।",
	},
	{
		id: "premium",
		keywords: [
			"premium",
			"pricing",
			"price",
			"plan",
			"subscription",
			"upgrade",
			"cost",
			"fee",
			"প্রিমিয়াম",
			"দাম",
			"প্ল্যান",
			"সাবস্ক্রিপশন",
			"ফি",
			"খরচ",
		],
		link: { to: "/pricing", label: "See plans" },
		en: "Every account starts on the Free plan. Premium plans for buyers, factories and buying houses add extra tools; the Pricing page lists exactly what each plan includes and costs.",
		bn: "প্রতিটি অ্যাকাউন্ট Free প্ল্যানে শুরু হয়। বায়ার, ফ্যাক্টরি ও বায়িং হাউজের Premium প্ল্যানে বাড়তি সুবিধা আছে; কোন প্ল্যানে কী আছে ও দাম কত তা Pricing পেজে দেখুন।",
	},
	{
		id: "payments",
		keywords: [
			"letter of credit",
			"lc",
			"payment",
			"pay",
			"bank transfer",
			"payment method",
			"পেমেন্ট",
			"এলসি",
			"ব্যাংক ট্রান্সফার",
		],
		link: { to: "/help", label: "Help Center" },
		en: "Payments between buyers and suppliers are made outside GarTexHub, by bank transfer or Letter of Credit (LC - a bank's promise to pay the supplier once the agreed shipping documents are presented). You can attach the bank-transfer or LC proof to the deal so both sides keep a record. Plan billing is under Subscription & Billing.",
		bn: "বায়ার ও সাপ্লায়ারের লেনদেন GarTexHub-এর বাইরে হয় — ব্যাংক ট্রান্সফার বা LC (Letter of Credit: নির্ধারিত শিপিং ডকুমেন্ট জমা দিলে ব্যাংক সাপ্লায়ারকে টাকা দেওয়ার নিশ্চয়তা)। দুই পক্ষের রেকর্ডের জন্য ব্যাংক ট্রান্সফার বা LC-এর প্রুফ ডিলে যুক্ত করতে পারেন। প্ল্যানের বিল Subscription & Billing-এ।",
	},
	{
		id: "contracts",
		keywords: ["contract", "e-sign", "esign", "signature", "কন্ট্রাক্ট", "চুক্তি", "সই", "স্বাক্ষর"],
		link: { to: "/contracts", label: "Contracts" },
		en: "Contracts are prepared, stored and signed in the Contracts Vault (Owner Dashboard → Contracts).",
		bn: "কন্ট্রাক্ট তৈরি, সংরক্ষণ ও সই করা হয় Contracts Vault-এ (Owner Dashboard → Contracts)।",
	},
	{
		id: "onboarding",
		keywords: [
			"onboarding",
			"setup",
			"set up",
			"getting started",
			"get started",
			"first steps",
			"অনবোর্ডিং",
		],
		link: { to: "/onboarding", label: "Open onboarding" },
		en: "Onboarding is the short setup after sign-up: profile image, organization details, product categories and (optional) certifications. You can skip it and come back from Support → Onboarding in the menu.",
		bn: "অনবোর্ডিং হলো সাইন-আপের পরের ছোট সেটআপ: প্রোফাইল ছবি, প্রতিষ্ঠানের তথ্য, প্রোডাক্ট ক্যাটাগরি ও (ঐচ্ছিক) সার্টিফিকেট। চাইলে এখন বাদ দিয়ে পরে মেনুর Support → Onboarding থেকে করতে পারেন।",
	},
	{
		id: "account_settings",
		keywords: [
			"settings",
			"change password",
			"two factor",
			"2fa",
			"dark mode",
			"theme",
			"notification settings",
			"account settings",
			"সেটিং",
			"পাসওয়ার্ড পরিবর্তন",
			"ডার্ক মোড",
			"নোটিফিকেশন",
		],
		link: { to: "/settings", label: "Open settings" },
		en: "Settings holds Theme, Notifications and Security (password, two-factor sign-in, active sessions). Company details are edited from My Profile.",
		bn: "Settings-এ আছে Theme, Notifications ও Security (পাসওয়ার্ড, টু-ফ্যাক্টর সাইন-ইন, সেশন)। প্রতিষ্ঠানের তথ্য My Profile থেকে এডিট করুন।",
	},
	{
		id: "login_help",
		keywords: [
			"forgot password",
			"reset password",
			"can't login",
			"cannot login",
			"login problem",
			"lost password",
			"পাসওয়ার্ড ভুলে",
			"লগইন হচ্ছে না",
			"লগইন সমস্যা",
		],
		combos: [
			[
				["forgot", "forget", "reset", "lost", "recover", "ভুলে", "রিসেট"],
				["password", "পাসওয়ার্ড"],
			],
		],
		link: { to: "/forgot-password", label: "Reset password" },
		en: `On the login page choose "Forgot password?", enter your account email and open the link we send (it works once and expires in 30 minutes). No email after a few minutes? Check spam, or contact ${SUPPORT_EMAIL}.`,
		bn: `লগইন পেজে "Forgot password?" চাপুন, অ্যাকাউন্টের ইমেইল দিন এবং পাঠানো লিংকটি খুলুন (একবারই কাজ করে, ৩০ মিনিটে মেয়াদ শেষ)। কয়েক মিনিটেও ইমেইল না এলে spam দেখুন অথবা ${SUPPORT_EMAIL}-এ যোগাযোগ করুন।`,
	},
	{
		id: "support",
		keywords: [
			"support",
			"help",
			"contact",
			"customer care",
			"complaint",
			"problem",
			"সাপোর্ট",
			"সাহায্য",
			"অভিযোগ",
			"সমস্যা",
		],
		link: { to: "/help", label: "Help Center" },
		en: `The Help Center answers the common questions. For anything else, email ${SUPPORT_EMAIL} or use Support → Contact Support in the menu.`,
		bn: `Help Center-এ সাধারণ প্রশ্নের উত্তর আছে। অন্য কিছু হলে ${SUPPORT_EMAIL}-এ ইমেইল করুন অথবা মেনুর Support → Contact Support ব্যবহার করুন।`,
	},
	{
		id: "thanks",
		keywords: ["thanks", "thank you", "thx", "dhonnobad", "ধন্যবাদ", "শুকরিয়া"],
		link: null,
		en: "You're welcome! Ask me anything else about GarTexHub.",
		bn: "আপনাকেও ধন্যবাদ! GarTexHub নিয়ে আর কিছু জানতে চাইলে জিজ্ঞেস করুন।",
	},
];

const UNKNOWN = {
	id: "unknown",
	link: { to: "/help", label: "Help Center" },
	en: `Sorry, I didn't understand that. I can help with accounts, verification, products, buyer requests, search, messaging and plans. For anything else, please contact support at ${SUPPORT_EMAIL}.`,
	bn: `দুঃখিত, প্রশ্নটি বুঝতে পারিনি। অ্যাকাউন্ট, ভেরিফিকেশন, প্রোডাক্ট, বায়ার রিকোয়েস্ট, সার্চ, মেসেজিং ও প্ল্যান নিয়ে সাহায্য করতে পারি। অন্য বিষয়ে ${SUPPORT_EMAIL}-এ যোগাযোগ করুন।`,
};

const BANGLA = /[ঀ-৿]/;

// Small talk and the catch-all "help": used only when no topic matched, so
// "help with onboarding" answers about onboarding.
const GENERIC_INTENTS = new Set(["greeting", "thanks", "support"]);

export function normalizeQuestion(text) {
	return String(text ?? "")
		.toLowerCase()
		.normalize("NFC")
		.replace(/[^\p{L}\p{M}\p{N}\s-]+/gu, " ")
		.replace(/\s+/g, " ")
		.trim();
}

// English: drop a plural "s" so "products" == "product". Bangla words take
// suffixes ("প্রোডাক্টের"), so a keyword matches the START of a word - but a
// keyword shorter than three letters must be the whole word ("ফি" is not
// "ভেরিফিকেশন").
function stem(token) {
	if (BANGLA.test(token)) return token;
	if (token.length > 4 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
	return token.length > 3 && token.endsWith("s") && !token.endsWith("ss")
		? token.slice(0, -1)
		: token;
}

function tokenize(text) {
	return normalizeQuestion(text).split(" ").filter(Boolean).map(stem);
}

function tokenMatches(questionToken, keywordToken) {
	if (BANGLA.test(keywordToken)) {
		return [...keywordToken].length < 3
			? questionToken === keywordToken
			: questionToken.startsWith(keywordToken);
	}
	return questionToken === keywordToken;
}

function phraseHit(questionTokens, phrase) {
	const keyTokens = tokenize(phrase);
	if (keyTokens.length === 0) return 0;
	for (let i = 0; i + keyTokens.length <= questionTokens.length; i += 1) {
		if (keyTokens.every((key, k) => tokenMatches(questionTokens[i + k], key))) {
			return 1 + keyTokens.length * 0.5;
		}
	}
	return 0;
}

// Every group must be present somewhere in the question ("can a factory
// register" and "register my factory" both hit factory + register).
function comboHit(questionTokens, groups) {
	return groups.every((group) => group.some((word) => phraseHit(questionTokens, word) > 0)) ? 2 : 0;
}

/**
 * Picks the best FAQ intent for a question.
 * @returns {{ id, text, link, language, confidence, matched }}
 */
export function answerFaq(question) {
	const questionTokens = tokenize(question);
	const language = BANGLA.test(questionTokens.join(" ")) ? "bn" : "en";
	const scored = INTENTS.map((intent) => {
		let score = 0;
		for (const keyword of intent.keywords) score += phraseHit(questionTokens, keyword);
		for (const combo of intent.combos || []) score += comboHit(questionTokens, combo);
		return { intent, score };
	});
	const hasTopic = scored.some(
		({ intent, score }) => !GENERIC_INTENTS.has(intent.id) && score >= 1.5,
	);
	let best = null;
	let bestScore = 0;
	let secondScore = 0;
	for (const { intent, score } of scored) {
		if (hasTopic && GENERIC_INTENTS.has(intent.id)) continue;
		if (score > bestScore) {
			secondScore = bestScore;
			bestScore = score;
			best = intent;
		} else if (score > secondScore) {
			secondScore = score;
		}
	}
	const matched = Boolean(best) && bestScore >= 1.5 && bestScore - secondScore >= 0.25;
	const intent = matched ? best : UNKNOWN;
	return {
		id: intent.id,
		text: intent[language],
		link: intent.link,
		language,
		confidence: matched ? Math.min(1, bestScore / 4) : 0,
		matched,
	};
}

/** Answer text with the link appended as Markdown (the assistant renders it). */
export function formatFaqAnswer(result) {
	if (!result?.link) return result?.text || "";
	return `${result.text}\n\n[${result.link.label}](${result.link.to})`;
}

export const FAQ_INTENT_IDS = INTENTS.map((intent) => intent.id);

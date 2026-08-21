// SVG -> PNG(1024/256) -> ICO 一站式生成
import { Resvg } from "@resvg/resvg-js";
import pngToIco from "png-to-ico";
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "fs";

mkdirSync("assets", { recursive: true });
mkdirSync("src/mainview/assets", { recursive: true });

const svg = readFileSync("assets/logo.svg");

function render(size: number): Buffer {
	const resvg = new Resvg(svg, {
		fitTo: { mode: "width", value: size },
		background: "rgba(0,0,0,0)",
	});
	return resvg.render().asPng();
}

const png1024 = render(1024);
writeFileSync("assets/logo-1024.png", png1024);
console.log("[1] assets/logo-1024.png", png1024.length, "bytes");

// 应用内使用（vite import 走 dist/assets 哈希产物，electrobun copy 规则覆盖）
copyFileSync("assets/logo-1024.png", "src/mainview/assets/logo.png");
console.log("[2] src/mainview/assets/logo.png");

const png256 = render(256);
const ico = await pngToIco(png256);
writeFileSync("assets/icon.ico", ico);
console.log("[3] assets/icon.ico", ico.length, "bytes");

console.log("ICON GEN PASS");

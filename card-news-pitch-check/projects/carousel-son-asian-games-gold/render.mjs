import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';

const project = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(project, '../..');
const cardsDir = path.join(project, 'cards');
const output = path.join(project, 'output');
const media = path.join(project, 'assets/media');
const fonts = path.join(project, 'assets/fonts');
for (const dir of [cardsDir, output, media, fonts]) fs.mkdirSync(dir, { recursive: true });

const copy = (from, to) => fs.copyFileSync(path.join(root, from), path.join(project, to));
copy('assets/fonts/gmarket/GmarketSansTTFBold.ttf', 'assets/fonts/GmarketSansTTFBold.ttf');
copy('assets/fonts/gmarket/GmarketSansTTFMedium.ttf', 'assets/fonts/GmarketSansTTFMedium.ttf');
copy('assets/reference/web/real-player-grounded-170/son-007-asian-games-gold.jpg', 'assets/media/medal-close.jpg');
copy('assets/reference/web/real-player-video-first-170/son-007-asian-games-gold.jpg', 'assets/media/medal-return.jpg');
copy('assets/reference/web/real-player-video-clips-170/son-007-asian-games-gold/card-01-frame.jpg', 'assets/media/arrival.jpg');
copy('assets/reference/web/real-player-video-clips-170/son-007-asian-games-gold/card-03-frame.jpg', 'assets/media/hug.jpg');
copy('assets/reference/web/real-player-video-clips-170/son-007-asian-games-gold/card-04-frame.jpg', 'assets/media/team-greeting.jpg');

const slides = [
  { image: 'medal-close.jpg', label: '2018 아시안게임', title: '골 없이도<br><b>결승을 지배한</b><br>주장 손흥민', body: '금메달 경기에서 그가 남긴 건 골이 아니라 두 번의 연결이었다.', cover: true },
  { image: 'medal-return.jpg', label: '결승전', title: '한국 2 : 1 일본<br><b>연장 두 골 모두</b><br>손흥민의 도움', body: '2018년 9월 1일. 한국은 연장 끝에 일본을 꺾고 금메달을 차지했다.' },
  { image: 'hug.jpg', label: '금메달 뒤', title: '금메달을 안고<br><b>돌아온 주장에게</b><br>동료들이 먼저 안겼다', body: '아시안게임을 마친 손흥민은 토트넘 훈련장으로 돌아와 동료들과 다시 만났다.' },
  { image: 'team-greeting.jpg', label: '우승 뒤', title: '직접 넣지 않아도<br><b>경기를 바꾸는</b><br>선수가 있다', body: '공보다 먼저 동료를 보고, 결정적인 순간에 연결했다.' },
  { image: 'arrival.jpg', label: '기록의 의미', title: '가장 큰 경기에서는<br><b>도움도 역사의</b><br>중심이 된다', body: '득점자만 기억하기 쉬운 밤. 하지만 우승을 만든 패스와 그 뒤의 환영도 함께 남았다.' },
];

const css = `
@font-face{font-family:Gmarket;src:url('../assets/fonts/GmarketSansTTFMedium.ttf');font-weight:500}
@font-face{font-family:Gmarket;src:url('../assets/fonts/GmarketSansTTFBold.ttf');font-weight:800}
*{box-sizing:border-box}html,body{margin:0;width:1080px;height:1350px;overflow:hidden;background:#060807;color:#fff;font-family:Gmarket,sans-serif;letter-spacing:0}.card{width:1080px;height:1350px;padding:58px 64px 62px;position:relative;background:#060807}.media{height:690px;overflow:hidden;border-radius:6px;position:relative}.media img{width:100%;height:100%;object-fit:cover}.media:after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 48%,rgba(0,0,0,.62))}.chip{position:absolute;left:22px;bottom:22px;z-index:2;background:rgba(0,0,0,.82);padding:11px 16px;font-size:24px;font-weight:800}.copy{padding-top:30px}.num{width:56px;height:56px;border-radius:50%;background:#08d6a6;color:#06100c;display:grid;place-items:center;font-size:29px;font-weight:800;margin-bottom:16px}h1{font-size:76px;line-height:1.08;margin:0;font-weight:800;word-break:keep-all}h1 b{color:#08d6a6}.body{font-size:32px;line-height:1.42;color:#d3dad7;margin-top:22px;max-width:920px;word-break:keep-all}.foot{position:absolute;left:64px;right:64px;bottom:42px;border-top:1px solid rgba(255,255,255,.13);padding-top:16px;display:flex;justify-content:space-between;color:#7f8d87;font-size:21px}.cover .media{height:1234px;margin:-58px -64px -62px;border-radius:0}.cover .media:after{background:linear-gradient(180deg,rgba(0,0,0,.08) 20%,rgba(0,0,0,.2) 48%,#060807 91%)}.cover .copy{position:absolute;left:64px;right:64px;bottom:86px;z-index:3}.cover h1{font-size:86px}.cover .chip{top:54px;bottom:auto;left:64px;background:#08d6a6;color:#06100c}.cover .body{font-size:29px}.cover .foot{z-index:4}
`;
fs.writeFileSync(path.join(cardsDir, 'style.css'), css);
slides.forEach((slide, index) => {
  const no = index + 1;
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><link rel="stylesheet" href="style.css"></head><body><main class="card ${slide.cover ? 'cover' : ''}"><section class="media"><img src="../assets/media/${slide.image}"><div class="chip">${slide.label}</div></section><section class="copy">${slide.cover ? '' : `<div class="num">${no}</div>`}<h1>${slide.title}</h1><div class="body">${slide.body}</div></section><div class="foot"><span>${String(no).padStart(2,'0')} / 07</span><span>Source · Tottenham Hotspur</span></div></main></body></html>`;
  fs.writeFileSync(path.join(cardsDir, `card-${String(no).padStart(2,'0')}.html`), html);
});

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1080, height: 1350 });
for (let number = 1; number <= 5; number += 1) {
  const id = String(number).padStart(2, '0');
  await page.goto(pathToFileURL(path.join(cardsDir, `card-${id}.html`)).href, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(output, `card-${id}.png`) });
}
await browser.close();
copy('projects/asset-pilot-son-100/assets/pitchcheck/approved-cta/card-06-approved.png', 'output/card-06.png');
copy('projects/asset-pilot-son-100/assets/pitchcheck/approved-cta/card-07-approved.png', 'output/card-07.png');

const inputs = Array.from({length:7},(_,i)=>['-i',path.join(output,`card-${String(i+1).padStart(2,'0')}.png`)]).flat();
const filter = `${Array.from({length:7},(_,i)=>`[${i}:v]scale=270:338[s${i}]`).join(';')};color=c=#060807:s=270x338[blank];${Array.from({length:7},(_,i)=>`[s${i}]`).join('')}[blank]xstack=inputs=8:layout=0_0|270_0|540_0|810_0|0_338|270_338|540_338|810_338[out]`;
const result=spawnSync('ffmpeg',['-y',...inputs,'-filter_complex',filter,'-map','[out]','-pix_fmt','yuv420p','-frames:v','1','-update','1',path.join(output,'contact-sheet.jpg')],{stdio:'inherit'});
if(result.status!==0)throw new Error('contact sheet failed');

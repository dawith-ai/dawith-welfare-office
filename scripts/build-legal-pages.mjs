// Builds the policy pages for the app (public/) and the product site (site/)
// from one source per page in docs/legal/, so both copies always say the same
// thing. Run after editing docs/legal/*.html:
//   npm run legal:build
// test/legal-pages.test.mjs fails if the generated files are out of date.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const legalEffectiveDate = '2026-11-11';
const effectiveLabel = '2026년 11월 11일';

export const legalPages = [
  { file: 'privacy.html', title: '개인정보처리방침', footer: '개인정보처리방침', lede: 'Dawith 복지 업무 도구함(Dawith Welfare Office)은 계정도, Dawith가 운영하는 서버도 없는 PC용 프로그램입니다. 이 문서는 앱이 어떤 정보를 어디에 저장하고, 언제 바깥으로 보내는지를 있는 그대로 적은 것입니다.' },
  { file: 'terms.html', title: '이용약관', footer: '이용약관', lede: 'Dawith 복지 업무 도구함을 쓰기 전에 알아 두실 이용 조건입니다. 어렵지 않게, 실제로 중요한 것만 적었습니다.' },
  { file: 'data-processing.html', title: '데이터 처리 안내', footer: '데이터 처리 안내', lede: '도구마다 넣은 파일과 글이 어디에서 처리되고, 어디에 남고, 바깥으로 나가는지를 하나씩 정리했습니다.' },
  { file: 'overseas.html', title: '해외 서버 안내', footer: '해외 서버 안내', lede: 'Dawith는 앱을 위한 서버를 운영하지 않고, 앱에는 클라우드 AI 기능이 없습니다. 해외 서버와 연결되는 경우는 작성한 내용이 담기지 않는 아래의 몇 가지 내려받기뿐입니다.' },
  { file: 'cookies.html', title: '광고·쿠키 안내', footer: '광고·쿠키 안내', lede: '광고도, 이용 통계(분석) 도구도, 추적 쿠키도 쓰지 않습니다. 앱이 이 PC에 저장하는 것과 소개 사이트가 저장하는 것을 정확히 적었습니다.' },
];

const copyright = '© 2024-2026 Dawith AI. All rights reserved.';
const legalLinks = (target = '') => legalPages.map((page) => `<a href="./${page.file}"${target}>${page.footer}</a>`).join('');

// Dawith signature badge, the same one welfare-hub.site shows in its footer.
// The hand-written site pages carry the identical markup.
export const siteSignature = '<a class="signature" href="https://dawith-link.vercel.app/Dawith_ai" target="_blank" rel="noreferrer"><img src="./dawith-ci.png" alt="" width="44" height="44" /><span><small>Created by</small><b>Dawith AI</b></span></a>';

export function siteLegalNav(current = '') {
  return `<nav class="legal-links" aria-label="법적 고지"><span>${copyright}</span>${legalPages.map((page) => `<a href="./${page.file}"${page.file === current ? ' aria-current="page"' : ''}>${page.footer}</a>`).join('')}</nav>`;
}

const meta = `<p class="legal-meta">시행일 ${effectiveLabel} · 문서 버전 ${legalEffectiveDate}</p>`;

function appPage(page, body) {
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#f6f6f3" />
    <meta name="description" content="${page.lede}" />
    <title>${page.title} · Dawith 복지 업무 도구함</title>
    <link rel="icon" href="./favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="./styles-legal.css" />
  </head>
  <body>
    <header class="legal-top">
      <a class="legal-brand" href="./"><img src="./dawith-ci.svg" alt="" /><span><b>Dawith</b><small>WELFARE TOOLS</small></span></a>
      <a class="legal-back" href="./">← 도구함으로 돌아가기</a>
    </header>
    <main class="legal-main" id="main">
      <p class="legal-overline">LEGAL · ${legalEffectiveDate}</p>
      <h1>${page.title}</h1>
      <p class="legal-lede">${page.lede}</p>
      ${meta}
      <div class="legal-doc">
${body}
      </div>
    </main>
    <footer class="legal-footer"><span>${copyright}</span>${legalLinks()}</footer>
  </body>
</html>
`;
}

function sitePage(page, body) {
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#f6f5f0" />
    <meta name="description" content="${page.lede}" />
    <title>${page.title} · Dawith 복지 업무 도구함</title>
    <link rel="icon" href="./favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <a class="skip-link" href="#main">본문으로 건너뛰기</a>
    <header class="nav" id="siteNav">
      <div class="wrap">
        <a class="brand" href="./"><img src="./dawith-ci.svg" alt="" />Dawith 복지 업무 도구함<span class="beta-tag">베타</span></a>
        <nav aria-label="주요 메뉴">
          <a class="opt" href="./updates.html">업데이트 소식</a>
          <a class="opt" href="./story.html">만든 이야기</a>
          <a href="./install.html">설치 도움말</a>
          <a href="./connect.html">로컬 AI</a>
          <a class="opt" href="./faq.html">자주 묻는 질문</a>
          <a href="./#contact">문의</a>
          <a class="nav-cta" href="./#download">내려받기</a>
        </nav>
      </div>
    </header>

    <main id="main">
      <div class="wrap">
        <section class="page-hero">
          <h1>${page.title}</h1>
          <p>${page.lede}</p>
          ${meta}
        </section>
        <div class="doc legal-doc">
${body}
        </div>
      </div>
    </main>

    <footer class="footer">
      <div class="wrap">
        <div class="maker"><img src="./dawith-ci.svg" alt="" /><div><p>만든이 <b>현직 사회복지사 · Dawith AI</b> · <a href="./story.html">만든 이야기</a></p><p>소스를 공개한 프로그램(Apache-2.0)으로, PDF는 <a href="https://github.com/Hopding/pdf-lib" target="_blank" rel="noreferrer">pdf-lib</a>(MIT), 한글 문서는 <a href="https://github.com/edwardkim/rhwp" target="_blank" rel="noreferrer">rhwp</a>(MIT)를 바탕으로 합니다. 이 사이트의 글꼴은 Pretendard(SIL OFL 1.1)입니다. · <a href="./opensource.html">오픈소스와 참고 자료</a></p></div></div>
        <nav aria-label="바닥글 메뉴">
          <a href="https://github.com/dawith-ai/dawith-welfare-office" target="_blank" rel="noreferrer">GitHub</a>
          <a href="https://github.com/dawith-ai/dawith-welfare-office/issues" target="_blank" rel="noreferrer">문제 알리기</a>
          <a href="https://welfare-hub.site/contact" target="_blank" rel="noreferrer">문의 게시판</a>
          <a href="./install.html">설치 도움말</a>
          <a href="./connect.html">로컬 AI 도움말</a>
          <a href="./faq.html">자주 묻는 질문</a>
          <a href="./updates.html">업데이트 소식</a>
          <a href="./story.html">만든 이야기</a>
          <a href="./opensource.html">오픈소스</a>
          <a href="https://welfare-hub.site" target="_blank" rel="noreferrer">Dawith 복지 허브</a>
        </nav>
        <p class="legal">누구나 무료로 쓰며, 있는 그대로 제공하고 따로 보증하지 않습니다. AI가 만든 결과는 검토용 초안이며 공식 기록은 담당자가 확정합니다. · 문의 <a href="mailto:dawith0ai@gmail.com">dawith0ai@gmail.com</a></p>
        ${siteLegalNav(page.file)}
        ${siteSignature}
      </div>
    </footer>
    <script src="./site.js"></script>
  </body>
</html>
`;
}

const indent = (text, spaces) => text.trim().split('\n').map((line) => (line ? ' '.repeat(spaces) + line : line)).join('\n');

export function renderLegalPages() {
  const output = new Map();
  for (const page of legalPages) {
    const body = fs.readFileSync(path.join(root, 'docs', 'legal', page.file), 'utf8').replace(/\r\n/g, '\n');
    output.set(path.join('public', page.file), appPage(page, indent(body, 8)));
    output.set(path.join('site', page.file), sitePage(page, indent(body, 10)));
  }
  return output;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const [relative, html] of renderLegalPages()) {
    fs.writeFileSync(path.join(root, relative), html);
    console.log(`wrote ${relative}`);
  }
}

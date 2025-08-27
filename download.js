const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://www.konkuk.ac.kr/oia/18776/subview.do';
const HOST = 'https://www.konkuk.ac.kr';
const SEARCH_KEYWORD = 'Chemnitz University of Technology'; // 원하는 검색어
const MAX_PAGE = 10; // 최대 페이지 수

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(BASE_URL, { waitUntil: 'networkidle2' });

  // 🔍 검색어 입력 및 Enter 키로 검색 실행
  await page.type('input[name="srchWrd"]', SEARCH_KEYWORD);
  await page.keyboard.press('Enter');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  // 페이지 루프
  for (let currentPage = 1; currentPage <= MAX_PAGE; currentPage++) {
    console.log(`📄 ${currentPage}페이지 처리 중`);

    // 게시글 링크 수집
    const links = await page.$$eval('.td-subject a', anchors =>
      anchors.map(a => a.getAttribute('href'))
    );

    // 각 게시글 처리
    for (const relativeLink of links) {
      const fullLink = HOST + relativeLink;
      const postPage = await browser.newPage();
      await postPage.goto(fullLink, { waitUntil: 'networkidle2' });

      try {
        const pdfHref = await postPage.$eval('a[href*="download.do"]', a => a.getAttribute('href'));
        const pdfUrl = HOST + pdfHref;
        const fileName = await postPage.$eval('a[href*="download.do"]', a => a.textContent.trim());
        const cleanName = fileName.replace(/[\\/:*?"<>|]/g, '_');

        const viewSource = await postPage.goto(pdfUrl);
        fs.writeFileSync(path.join(downloadDir, cleanName), await viewSource.buffer());

        console.log(`✅ 저장 완료: ${cleanName}`);
      } catch (err) {
        if (!err.message.includes('net::ERR_ABORTED')) {
          console.error(`❌ 다운로드 실패: ${fullLink}`, err.message);
        }
      }

      await postPage.close();
    }

    // 다음 페이지 클릭 (마지막 페이지일 경우 스킵)
    if (currentPage < MAX_PAGE) {
        try {
        await page.evaluate((pageNum) => {
            page_link(String(pageNum));
        }, currentPage + 1);
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        } catch (err) {
            console.log(`⚠️ 다음 페이지(${currentPage + 1})로 이동 실패. 반복 종료`);
            break;
        }
    }
  }

  await browser.close();
})();
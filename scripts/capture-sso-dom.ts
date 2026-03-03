/**
 * Capture SSO login page DOM structure for selector discovery.
 * Saves: sso-dom.html (full HTML), sso-forms.json (form elements summary)
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

async function main() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
  });

  console.log("Navigating to SSO...");
  await page.goto("https://road.hycu.ac.kr/", { waitUntil: "networkidle", timeout: 30000 });
  console.log("URL:", page.url());

  // Save full HTML
  const html = await page.content();
  writeFileSync("sso-dom.html", html);
  console.log(`Saved sso-dom.html (${html.length} chars)`);

  // Extract form elements summary
  const formInfo = await page.evaluate(() => {
    const result: Record<string, unknown> = {};

    // All inputs
    result.inputs = Array.from(document.querySelectorAll("input")).map((el) => ({
      type: el.type,
      name: el.name,
      id: el.id,
      placeholder: el.placeholder,
      className: el.className,
      value: el.value,
      visible: el.offsetParent !== null,
      parentId: el.parentElement?.id,
      parentClass: el.parentElement?.className,
    }));

    // All buttons
    result.buttons = Array.from(document.querySelectorAll("button, input[type=submit], a.btn, a[class*=btn]")).map((el) => ({
      tag: el.tagName,
      type: (el as HTMLButtonElement).type,
      id: el.id,
      className: el.className,
      text: el.textContent?.trim().substring(0, 50),
      visible: el.offsetParent !== null,
      onclick: el.getAttribute("onclick")?.substring(0, 100),
    }));

    // All tabs/nav elements
    result.tabs = Array.from(document.querySelectorAll("[class*=tab], [class*=Tab], [role=tab], li > a")).map((el) => ({
      tag: el.tagName,
      id: el.id,
      className: el.className,
      text: el.textContent?.trim().substring(0, 50),
      href: (el as HTMLAnchorElement).href,
      onclick: el.getAttribute("onclick")?.substring(0, 100),
    }));

    // All forms
    result.forms = Array.from(document.querySelectorAll("form")).map((el) => ({
      id: el.id,
      name: el.name,
      action: el.action,
      method: el.method,
      className: el.className,
    }));

    // Card/section containers  
    result.sections = Array.from(document.querySelectorAll("[class*=card], [class*=login], [class*=auth], section, .area, [class*=area]")).map((el) => ({
      tag: el.tagName,
      id: el.id,
      className: el.className,
      childCount: el.children.length,
      text: el.textContent?.trim().substring(0, 80),
    }));

    return result;
  });

  writeFileSync("sso-forms.json", JSON.stringify(formInfo, null, 2));
  console.log("Saved sso-forms.json");

  // Now try clicking the PIN card to see what happens
  console.log("\n--- Attempting to find PIN auth card ---");
  
  // Look for 간편번호 text
  const pinCard = page.locator('text=간편번호').first();
  if (await pinCard.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log("Found '간편번호' text element");
    
    // Find the clickable parent/card
    const cardParent = page.locator(':has-text("간편번호 인증")').last();
    console.log("Card parent found");
  }

  // Try finding student ID input in PIN card area
  const allInputs = await page.locator("input").all();
  console.log(`\nTotal inputs on page: ${allInputs.length}`);
  for (let i = 0; i < allInputs.length; i++) {
    const inp = allInputs[i];
    const attrs = await inp.evaluate((el) => ({
      type: el.type, name: el.name, id: el.id, 
      placeholder: el.placeholder, visible: el.offsetParent !== null,
    }));
    console.log(`  input[${i}]:`, JSON.stringify(attrs));
  }

  // Try entering student ID in the PIN card's input
  console.log("\n--- Entering student ID in PIN card ---");
  // Look for input near 간편번호
  const pinSection = page.locator(':has-text("간편번호")').filter({ has: page.locator('input') });
  const sectionInputs = await pinSection.locator('input').all();
  console.log(`Inputs in PIN section: ${sectionInputs.length}`);
  
  if (sectionInputs.length > 0) {
    await sectionInputs[0].fill("2024112536");
    console.log("Filled student ID");
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "sso-after-id.png" });
    
    // Check for new elements (PIN input, submit button)
    const afterInputs = await page.locator("input").all();
    console.log(`\nInputs after filling ID: ${afterInputs.length}`);
    for (let i = 0; i < afterInputs.length; i++) {
      const inp = afterInputs[i];
      const attrs = await inp.evaluate((el) => ({
        type: el.type, name: el.name, id: el.id,
        placeholder: el.placeholder, visible: el.offsetParent !== null,
      }));
      console.log(`  input[${i}]:`, JSON.stringify(attrs));
    }
  }

  // Look for a submit/login button in PIN area
  const pinButtons = await pinSection.locator('button, a[class*=btn]').all();
  console.log(`\nButtons in PIN section: ${pinButtons.length}`);
  for (const btn of pinButtons) {
    const text = await btn.textContent();
    const onclick = await btn.getAttribute("onclick");
    console.log(`  button: "${text?.trim()}" onclick=${onclick?.substring(0, 80)}`);
  }

  // Click the button (신규등록 or login) to see what happens
  if (pinButtons.length > 0) {
    const firstBtn = pinButtons[0];
    const btnText = await firstBtn.textContent();
    console.log(`\nClicking button: "${btnText?.trim()}"`);
    
    // Listen for popups/dialogs
    page.on("dialog", async (dialog) => {
      console.log(`Dialog: ${dialog.type()} - ${dialog.message()}`);
      await dialog.accept();
    });
    
    const [popup] = await Promise.all([
      page.waitForEvent("popup", { timeout: 5000 }).catch(() => null),
      firstBtn.click(),
    ]);
    
    if (popup) {
      console.log("Popup opened:", popup.url());
      await popup.waitForLoadState("networkidle").catch(() => {});
      const popupHtml = await popup.content();
      writeFileSync("sso-popup.html", popupHtml);
      console.log(`Saved sso-popup.html (${popupHtml.length} chars)`);
      await popup.screenshot({ path: "sso-popup.png" });
    }
    
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "sso-after-click.png" });
    
    // Check page state again
    const finalHtml = await page.content();
    writeFileSync("sso-dom-after.html", finalHtml);
    console.log(`Saved sso-dom-after.html (${finalHtml.length} chars)`);
  }

  await browser.close();
  console.log("\nDone.");
}

main().catch(console.error);

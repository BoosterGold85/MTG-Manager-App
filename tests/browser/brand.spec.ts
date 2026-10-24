import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('brand palette, focus and selected states are applied without disrupting binder controls',async({page},info)=>{
 await page.goto('/');await expect(page.locator('.card-tile')).toHaveCount(32);
 await expect(page.locator('html')).toHaveCSS('background-color','rgb(21, 23, 19)');
 await expect(page.locator('html')).toHaveCSS('color','rgb(244, 241, 232)');
 await expect(page.locator('.search-bar')).toHaveCSS('background-color','rgb(29, 32, 26)');
 const search=page.getByRole('searchbox',{name:'Search cards by name'});await search.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');
 await expect(page.locator('.search-bar')).toHaveCSS('outline-color','rgb(216, 176, 88)');await expect(page.locator('.search-bar')).toHaveCSS('outline-style','solid');
 await page.getByRole('button',{name:'Green',exact:true}).click();await expect(page.getByRole('button',{name:'Green',exact:true})).toHaveAttribute('aria-pressed','true');
 expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
 await page.screenshot({path:info.outputPath('brand-collection.png'),fullPage:true});
 await page.getByRole('button',{name:/^Filters/}).click();await expect(page.getByRole('dialog')).toHaveCSS('opacity','1');await expect(page.getByRole('dialog')).toHaveCSS('background-color','rgb(29, 32, 26)');
 expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);await page.screenshot({path:info.outputPath('brand-filter.png')});
});
test('favicon manifest and home-screen assets resolve with correct metadata and native dimensions',async({page,request})=>{
 await page.goto('/');
 const manifestUrl=await page.locator('link[rel=manifest]').getAttribute('href');expect(manifestUrl).toBe('/manifest.webmanifest');
 const manifestResponse=await request.get(manifestUrl!);expect(manifestResponse.ok()).toBe(true);const manifest=await manifestResponse.json();
 expect(manifest.name).toBe('MTG Manager');expect(manifest.short_name).toBe('MTG Manager');expect(manifest.theme_color.toLowerCase()).toBe('#151713');expect(manifest.background_color.toLowerCase()).toBe('#151713');expect(manifest.start_url).toBe('/');
 expect(manifest.icons.some((icon:{purpose:string;sizes:string})=>icon.purpose==='maskable'&&icon.sizes==='512x512')).toBe(true);
 await expect(page.locator('meta[name=theme-color]')).toHaveAttribute('content','#151713');await expect(page.locator('link[rel=apple-touch-icon]')).toHaveAttribute('href','/icons/icon-180.png');
 for(const size of [16,32,48,180,192,512,1024]) {
  const dimensions=await page.evaluate(async size=>{const image=new Image();image.src=`/icons/icon-${size}.png`;await image.decode();return [image.naturalWidth,image.naturalHeight];},size);expect(dimensions).toEqual([size,size]);
 }
 const svg=await request.get('/favicon.svg');expect(svg.ok()).toBe(true);expect(await svg.text()).toContain('#D0C098');expect(await svg.text()).not.toContain('<text');
 const ico=await request.get('/favicon.ico');expect(ico.ok()).toBe(true);const bytes=await ico.body();expect(bytes.readUInt16LE(2)).toBe(1);expect(bytes.readUInt16LE(4)).toBe(3);
});

import {chromium,expect} from '@playwright/test';
const url=process.env.ANSWERCUE_UI_TEST_URL || 'http://127.0.0.1:5180/tests/fixtures/upstream-preview.html';
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:960}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${url}?mode=launcher`);
 await page.getByPlaceholder('Tell me about your interview...').fill('Remember the Northstar interview context.');
 await page.getByTitle('Send message',{exact:true}).click();
 await expect(page.getByText('A concise answer.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Select messages',exact:true}).click();
 await page.getByRole('checkbox',{name:'Select message: Remember the Northstar interview context.',exact:true}).check();
 await page.getByRole('button',{name:'Delete selected (1)',exact:true}).click();
 await expect(page.getByText('Remember the Northstar interview context.',{exact:true})).toHaveCount(0);
 await expect.poll(()=>page.evaluate(()=>window.testState.workspace.chatContextEdited)).toBe(true);
 await page.getByRole('button',{name:'Fork chat',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Saved interview (fork)',exact:true})).toBeVisible();
 console.log('PASS: chat send, selected deletion, edited-context persistence and fork navigation');
 await page.goto(url);
 await expect(page.getByText('Default Model for Chat',{exact:true})).toBeVisible();
 await expect(page.getByText('Transcription providers',{exact:false}).first()).toBeVisible();
 await page.getByLabel('Action name',{exact:true}).fill('Recap');
 await page.getByLabel('Action instructions',{exact:true}).fill('Summarize the latest interviewer question in three bullets.');
 await page.getByRole('button',{name:'Add action (0/4)',exact:true}).click();
 await page.reload();await expect(page.getByLabel('Delete Recap',{exact:true})).toBeVisible();
 await page.goto(`${url}?mode=overlay`);
 const input=page.locator('input[type=text]').last();const box=await input.boundingBox();expect(box).not.toBeNull();
 for(const ratio of [0.15,0.5,0.85]) {await page.mouse.click(box.x+box.width/2,box.y+box.height*ratio);await expect(input).toBeFocused();await page.keyboard.type('a');}
 await expect(input).toHaveValue('aaa');await input.fill('');
 await page.getByRole('button',{name:'Recap',exact:true}).last().click();
 await expect.poll(()=>page.evaluate(()=>window.testState.queries.length)).toBe(1);
 expect(await page.evaluate(()=>window.testState.queries[0].query)).toBe('Summarize the latest interviewer question in three bullets.');
 console.log('PASS: provider settings render, action persistence, action execution, popup focus at three heights');
 expect(errors).toEqual([]);
} finally {await browser.close();}

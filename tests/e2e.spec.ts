import { test, expect } from '@playwright/test';

test.describe('Musikquiz Game Connectivity', () => {
  test('User can create a host room and a player can join', async ({ browser }) => {
    // We launch two contexts to simulate two separate users
    const hostContext = await browser.newContext();
    const playerContext = await browser.newContext();

    const hostPage = await hostContext.newPage();
    const playerPage = await playerContext.newPage();

    // The test server should be running on localhost:3000 during test
    await hostPage.goto('http://localhost:3333/');

    // Click "Starta som Värd (Host)"
    await hostPage.click('button#btn-role-host');

    // Wait for room to be created and pin code to be visible
    // Wait for the room PIN text
    await hostPage.waitForSelector('text=Spelkod / PIN');

    // Get the room code
    const element = await hostPage.locator('.tracking-widest.tabular-nums').innerText();
    const roomCode = element.trim();
    
    expect(roomCode).toBeTruthy();
    expect(roomCode.length).toBe(4);

    // Now player joins with the room code
    await playerPage.goto('http://localhost:3333/');
    await playerPage.click('button#btn-role-player');
    
    // Fill the form on the player page
    await playerPage.fill('input[placeholder="T.ex. ABCD"]', roomCode);
    await playerPage.fill('input[placeholder="Skriv in namn..."]', 'TestPlayer');
    await playerPage.click('button#btn-player-join-submit');

    // Wait for Join Success by checking for Lobby text on player
    await playerPage.waitForSelector('text=Du är ansluten!');
    
    // Verify the host also saw the player joining!
    await hostPage.waitForSelector('text=TestPlayer');
  });
});

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
    await expect(hostPage.locator('.tracking-widest.tabular-nums')).not.toBeEmpty();

    // Verify that exactly 3 presets are presented in the lobby grid
    await expect(hostPage.locator('button[id^="preset-"]')).toHaveCount(3);

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

  test('User can play a 1-song game and dynamic play counts increment', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const playerContext = await browser.newContext();

    const hostPage = await hostContext.newPage();
    const playerPage = await playerContext.newPage();

    // Helper to extract the numeric play count from a preset card element
    const getPlayCount = async (locator: any) => {
      // Retry reading text to prevent race conditions while React processes WebSocket updates
      for (let i = 0; i < 10; i++) {
        const text = await locator.innerText();
        const match = text.match(/(\d+)\s+spelningar/i);
        if (match) {
          return parseInt(match[1]);
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return 0;
    };

    // 1. Goto host lobby creation screen
    await hostPage.goto('http://localhost:3333/');
    await hostPage.click('button#btn-role-host');
    await hostPage.waitForSelector('text=Spelkod / PIN');
    await expect(hostPage.locator('.tracking-widest.tabular-nums')).not.toBeEmpty();

    // 2. Select the first preset in the ranked list (which is guaranteed to exist since we have 3)
    const targetPresetElement = hostPage.locator('button[id^="preset-"]').first();
    await expect(targetPresetElement).toBeVisible();
    
    const presetId = await targetPresetElement.getAttribute('id');
    const targetPreset = hostPage.locator(`#${presetId}`);

    // Dynamically retrieve initial play count
    const initialPlayCount = await getPlayCount(targetPreset);

    await targetPreset.click();

    // 3. Set song count to 1 by clicking the '-' button 9 times (default is 10)
    const minusBtn = hostPage.locator('button#btn-songcount-minus');
    for (let i = 0; i < 9; i++) {
      await minusBtn.click();
    }

    // Assert song count is 1
    await expect(hostPage.locator('text=1').first()).toBeVisible();

    // Get the room code (after selecting preset, as that recreates the room)
    const element = await hostPage.locator('.tracking-widest.tabular-nums').innerText();
    const roomCode = element.trim();

    // Player joins the room so we can start
    await playerPage.goto('http://localhost:3333/');
    await playerPage.click('button#btn-role-player');
    await playerPage.fill('input[placeholder="T.ex. ABCD"]', roomCode);
    await playerPage.fill('input[placeholder="Skriv in namn..."]', 'TestPlayer');
    await playerPage.click('button#btn-player-join-submit');
    await playerPage.waitForSelector('text=Du är ansluten!');

    // Wait for the host to see the player
    await hostPage.waitForSelector('text=TestPlayer');

    // 4. Start the game
    await hostPage.click('button#btn-host-start');

    // 5. Wait for the game to start and the question reveal button to become visible (timer to cover 5s countdown)
    await hostPage.waitForSelector('button#btn-reveal', { timeout: 15000 });

    // 6. Click 'Avslöja svar direkt'
    await hostPage.click('button#btn-reveal');

    // 7. Click 'Visa Ställningen' (btn-reveal-next)
    await hostPage.waitForSelector('button#btn-reveal-next');
    await hostPage.click('button#btn-reveal-next');

    // 8. Click 'Avsluta & gå till lobbyn' (btn-board-reset)
    await hostPage.waitForSelector('button#btn-board-reset');
    await hostPage.click('button#btn-board-reset');

    // 9. Now we are back at the landing page. Host a game again to open the lobby.
    await hostPage.waitForSelector('button#btn-role-host');
    await hostPage.click('button#btn-role-host');
    await hostPage.waitForSelector('text=Spelkod / PIN');
    await expect(hostPage.locator('.tracking-widest.tabular-nums')).not.toBeEmpty();

    // 10. Verify that the target preset now shows initialPlayCount + 1 'spelningar'!
    await expect(hostPage.locator(`#${presetId}`)).toContainText(`${initialPlayCount + 1} spelningar`);

    // 11. Play again to verify it increments to 2
    await hostPage.click(`#${presetId}`);
    for (let i = 0; i < 9; i++) {
      await minusBtn.click();
    }

    // Get the new room code
    const newElement = await hostPage.locator('.tracking-widest.tabular-nums').innerText();
    const newRoomCode = newElement.trim();

    // Player joins the new room
    await playerPage.goto('http://localhost:3333/');
    await playerPage.click('button#btn-role-player');
    await playerPage.fill('input[placeholder="T.ex. ABCD"]', newRoomCode);
    await playerPage.fill('input[placeholder="Skriv in namn..."]', 'TestPlayer');
    await playerPage.click('button#btn-player-join-submit');
    await playerPage.waitForSelector('text=Du är ansluten!');
    await hostPage.waitForSelector('text=TestPlayer');

    await hostPage.click('button#btn-host-start');
    await hostPage.waitForSelector('button#btn-reveal', { timeout: 15000 });
    await hostPage.click('button#btn-reveal');
    await hostPage.waitForSelector('button#btn-reveal-next');
    await hostPage.click('button#btn-reveal-next');
    await hostPage.waitForSelector('button#btn-board-reset');
    await hostPage.click('button#btn-board-reset');

    // 12. Host again and verify initialPlayCount + 2 'spelningar'
    await hostPage.waitForSelector('button#btn-role-host');
    await hostPage.click('button#btn-role-host');
    await hostPage.waitForSelector('text=Spelkod / PIN');
    await expect(hostPage.locator('.tracking-widest.tabular-nums')).not.toBeEmpty();
    
    // 12. Verify that the target preset now shows initialPlayCount + 2 'spelningar'
    await expect(hostPage.locator(`#${presetId}`)).toContainText(`${initialPlayCount + 2} spelningar`);

    // Cleanup pages and contexts
    await hostPage.close();
    await playerPage.close();
    await hostContext.close();
    await playerContext.close();
  });
});

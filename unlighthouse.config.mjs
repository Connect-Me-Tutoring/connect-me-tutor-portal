export default {
  site: 'https://www.connectmego.app/',
  puppeteerOptions: {
    executablePath: '/usr/bin/chromium-browser',
    // Required for WSL and headless environments
    // args: ['--no-sandbox', '--disable-setuid-sandbox']
  },
  scanner: {
    exclude: [
      '/logout', 
      '/sign-out', 
      '/delete/**',
      '/settings/**',
      '/api/**',
      '**?delete=**',
    ]
  },
  lighthouseOptions: {
    disableStorageReset: true,
  },
  hooks: {
    async authenticate(page) {
      console.log('--- Unlighthouse: Starting Login Hook ---')
      
      // Used for WSL/React hydration
      page.setDefaultTimeout(60000);
      page.setDefaultNavigationTimeout(60000);

      await page.goto('https://www.connectmego.app/', { waitUntil: 'domcontentloaded' });

      // Using the placeholder ensures we match your shadcn/ui Input
      const emailSelector = 'input[placeholder="Enter your email address"]';
      await page.waitForSelector(emailSelector, { visible: true });

      // Fill the form with delays for Zod/React-Hook-Form
      console.log('Filling credentials...');
      await page.type(emailSelector, 'example@gmail.com', { delay: 50 });
      await page.type('input[placeholder="Enter your password"]', 'example_password', { delay: 50 });

      // Submit and wait for redirect to /dashboard
      console.log('Submitting...');
      await Promise.all([
        page.click('button[type="submit"]'),
        // Your code redirects to /dashboard, so we wait for the network to settle
        page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      ]);
      
      console.log('--- Unlighthouse: Login Successful! Starting Scan ---')
    },
  },
}
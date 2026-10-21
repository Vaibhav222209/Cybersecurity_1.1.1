export type LearningModule = {
  id: string;
  title: string;
  category: string;
  description: string;
  duration: number;
  level: 'Beginner' | 'Intermediate';
  icon: 'key' | 'mail' | 'network' | 'shield' | 'globe' | 'alert';
  color: string;
  lessons: { title: string; body: string }[];
  quiz: {
    question: string;
    options: string[];
    correct: number;
    explanation: string;
  }[];
};

export const modules: LearningModule[] = [
  {
    id: 'password-security',
    title: 'Better passwords, safer accounts',
    category: 'Account security',
    description: 'Build strong sign-ins with unique passwords, a password manager, and MFA.',
    duration: 6,
    level: 'Beginner',
    icon: 'key',
    color: '#eaf0db',
    lessons: [
      {
        title: 'Make every password unique',
        body: 'Use a different password for every account so one breach cannot unlock the others. Let a reputable password manager generate long, random passwords; for a password you must remember, choose a long passphrase with unrelated words.',
      },
      {
        title: 'Add another layer',
        body: 'Enable multi-factor authentication, especially for email, banking, and your password manager. Prefer passkeys or security keys when supported because they resist phishing; an authenticator app is also a useful improvement over a password alone.',
      },
      {
        title: 'Keep recovery under your control',
        body: 'Store recovery codes somewhere secure and separate from the device they recover. Change a password when it is exposed, reused, or suspected compromised; a forced routine rotation is not a substitute for a strong, unique password.',
      },
    ],
    quiz: [
      {
        question: 'Why should each account have its own password?',
        options: [
          'It makes every website load faster.',
          'A password stolen from one service cannot be reused on your other accounts.',
          'It removes the need for multi-factor authentication.',
        ],
        correct: 1,
        explanation: 'Attackers often try leaked credentials on other services. A unique password limits the damage from one breach.',
      },
      {
        question: 'Which sign-in method offers resistance to phishing?',
        options: [
          'A passkey or a compatible security key.',
          'A password made from your birthday.',
          'The same complex password on every account.',
        ],
        correct: 0,
        explanation: 'Passkeys and security keys bind authentication to the real service, helping prevent sign-in through an impostor website.',
      },
      {
        question: 'You learn that a password you use has been exposed. What should you do?',
        options: [
          'Wait until your next scheduled password change.',
          'Add the current year to it and reuse it everywhere.',
          'Replace it with a unique password, check account activity, and enable MFA.',
        ],
        correct: 2,
        explanation: 'Replace an exposed password promptly, including on any accounts where it was reused. Review sessions and recovery settings for unauthorized changes.',
      },
    ],
  },
  {
    id: 'phishing-awareness',
    title: 'Spot the phishing attempt',
    category: 'Threat awareness',
    description: 'Recognize pressure tactics and verify suspicious messages before acting.',
    duration: 7,
    level: 'Beginner',
    icon: 'mail',
    color: '#fff0d9',
    lessons: [
      {
        title: 'Slow down when a message pushes urgency',
        body: 'Phishing messages often use fear, a reward, or a time limit to make you act before checking. A familiar logo, a convincing sender name, or correct grammar does not prove a message is authentic.',
      },
      {
        title: 'Verify through a separate route',
        body: 'If a message asks you to sign in, open the official app or use a bookmark you already trust instead of its link. Confirm unexpected payment or account requests through a known contact method, not a phone number supplied in the suspicious message.',
      },
      {
        title: 'Treat links and attachments with care',
        body: 'Inspect the actual destination of a link and check the complete hostname for lookalikes. HTTPS encrypts a connection but does not prove a site is trustworthy; do not open unexpected attachments or approve an MFA prompt you did not initiate.',
      },
    ],
    quiz: [
      {
        question: 'A message says your account closes in ten minutes unless you sign in. What is the safest next step?',
        options: [
          'Use the supplied link immediately.',
          'Open the official app or trusted website directly to check your account.',
          'Reply with your password to confirm your identity.',
        ],
        correct: 1,
        explanation: 'Use a route you already trust. Urgency is a common social engineering tactic, and the message itself may be fraudulent.',
      },
      {
        question: 'What does HTTPS tell you about a website?',
        options: [
          'The connection is encrypted, but the site could still be malicious.',
          'The site has been checked and approved for every use.',
          'Any file downloaded from it is safe.',
        ],
        correct: 0,
        explanation: 'HTTPS protects data in transit to that hostname. Attackers can also obtain certificates and run HTTPS websites.',
      },
      {
        question: 'You receive an MFA approval prompt without trying to sign in. What should you do?',
        options: [
          'Approve it to stop the notifications.',
          'Share the approval code with the person who calls next.',
          'Deny it, then review your account security through the official service.',
        ],
        correct: 2,
        explanation: 'An unexpected prompt may mean someone has your password. Deny the request and investigate through the legitimate service.',
      },
    ],
  },
  {
    id: 'network-basics',
    title: 'Know your network',
    category: 'Network security',
    description: 'Understand secure connections and make your home Wi-Fi harder to misuse.',
    duration: 8,
    level: 'Beginner',
    icon: 'network',
    color: '#e4edf9',
    lessons: [
      {
        title: 'Separate an address from an identity',
        body: 'DNS helps translate a domain name into an IP address, while routers move traffic between networks. Neither an IP address nor a familiar-looking domain proves that the person or service behind it is trustworthy.',
      },
      {
        title: 'Protect your home router',
        body: 'Use WPA3-Personal when available, or WPA2 with AES, and choose a strong Wi-Fi password. Change the router administrator password from its default, install firmware updates, and disable remote administration unless you need and securely configure it.',
      },
      {
        title: 'Use shared networks thoughtfully',
        body: 'Confirm the correct Wi-Fi network name with its operator and disable automatic joining of unknown networks. Keep HTTPS enabled and avoid certificate warnings; a trusted VPN can protect traffic between your device and its provider, but it cannot make a malicious website safe.',
      },
    ],
    quiz: [
      {
        question: 'Which Wi-Fi configuration should you prefer when supported?',
        options: [
          'An open network without a password.',
          'WEP because it works with older devices.',
          'WPA3-Personal with a strong password.',
        ],
        correct: 2,
        explanation: 'WPA3 is the preferred modern option. WPA2 with AES is an alternative when WPA3 is unavailable; WEP is obsolete.',
      },
      {
        question: 'What is one of the jobs of DNS?',
        options: [
          'Translating domain names into network addresses.',
          'Guaranteeing that all websites are honest.',
          'Removing the need for software updates.',
        ],
        correct: 0,
        explanation: 'DNS resolves names to network addresses. It does not establish whether a website or its content is trustworthy.',
      },
      {
        question: 'Which statement about a VPN is accurate?',
        options: [
          'It makes every link and downloaded file safe.',
          'It protects traffic to the VPN provider, but does not prevent all phishing or malware.',
          'It replaces the need for HTTPS and MFA.',
        ],
        correct: 1,
        explanation: 'A VPN changes who carries part of your traffic. You still need trusted websites, secure authentication, and updated software.',
      },
    ],
  },
  {
    id: 'device-security',
    title: 'Harden your everyday devices',
    category: 'Device security',
    description: 'Reduce everyday risk with updates, screen locks, encryption, and careful installs.',
    duration: 6,
    level: 'Beginner',
    icon: 'shield',
    color: '#e9e5f7',
    lessons: [
      {
        title: 'Close known security gaps',
        body: 'Install operating system, browser, and app updates from trusted sources, and enable automatic security updates where possible. Replace unsupported software or devices because they may no longer receive fixes for newly discovered vulnerabilities.',
      },
      {
        title: 'Protect a lost or unattended device',
        body: 'Set a strong device unlock code, enable automatic screen locking, and turn on full-disk encryption. Encryption helps protect stored data when a locked device is lost, but it does not protect you from everything that runs while you are signed in.',
      },
      {
        title: 'Give apps only what they need',
        body: 'Install software from reputable sources and review requested permissions before accepting them. Remove unused apps and browser extensions, use a standard user account for daily work where practical, and keep built-in security protections enabled.',
      },
    ],
    quiz: [
      {
        question: 'Why are security updates useful?',
        options: [
          'They guarantee that a device can never be attacked.',
          'They fix known weaknesses that attackers may exploit.',
          'They make backups unnecessary.',
        ],
        correct: 1,
        explanation: 'Updates close known vulnerabilities and reduce risk. They work alongside backups, careful app choices, and other security controls.',
      },
      {
        question: 'What is a key benefit of full-disk encryption?',
        options: [
          'It helps protect stored data if a locked device is lost or stolen.',
          'It identifies every phishing email.',
          'It prevents all malware while you are logged in.',
        ],
        correct: 0,
        explanation: 'Disk encryption is especially useful for protecting data at rest. A signed-in session and malicious software create different risks.',
      },
      {
        question: 'A flashlight app requests access to all your contacts. What should you do?',
        options: [
          'Grant access because every permission is necessary.',
          'Disable system security to make it work.',
          'Question the request, deny unnecessary access, and consider a trusted alternative.',
        ],
        correct: 2,
        explanation: 'Permissions should match an app’s purpose. Limiting unnecessary access reduces the data an app can misuse or expose.',
      },
    ],
  },
  {
    id: 'web-privacy',
    title: 'Take control of your web privacy',
    category: 'Privacy',
    description: 'Understand browser privacy limits and reduce the information you share online.',
    duration: 7,
    level: 'Intermediate',
    icon: 'globe',
    color: '#e0f0ec',
    lessons: [
      {
        title: 'Know what private browsing does',
        body: 'Private browsing reduces the history and session data retained by that browser after you close the private session. It does not make you anonymous to websites, your employer or school, your internet provider, or services you sign in to.',
      },
      {
        title: 'Share less by default',
        body: 'Review social profile visibility, location sharing, and app access to your accounts. Remove data and connected apps you no longer need, and remember that information shared with another person can be copied even when a service offers privacy controls.',
      },
      {
        title: 'Keep the browser trustworthy',
        body: 'Keep your browser updated, enable its tracking protections, and install only extensions you need and trust. Never bypass an unexpected certificate warning just to continue; verify the address and connection or use a different trusted route.',
      },
    ],
    quiz: [
      {
        question: 'What does private browsing primarily help with?',
        options: [
          'Hiding all activity from your internet provider.',
          'Making any website safe to use.',
          'Reducing browsing history and session data saved locally after the private session closes.',
        ],
        correct: 2,
        explanation: 'Private mode mainly controls what the browser retains locally. Websites and network operators may still observe activity.',
      },
      {
        question: 'Which action can reduce unnecessary exposure of personal information?',
        options: [
          'Reviewing profile visibility and removing unused connected apps.',
          'Posting recovery codes on a private social profile.',
          'Granting every browser extension access to all websites.',
        ],
        correct: 0,
        explanation: 'Reviewing access and sharing settings helps limit who receives your data. Recovery codes should always remain secret.',
      },
      {
        question: 'Your browser shows an unexpected certificate warning. What is the safer response?',
        options: [
          'Continue because the page has a familiar logo.',
          'Stop, check the address and connection, and reach the service through a trusted route.',
          'Turn off certificate verification permanently.',
        ],
        correct: 1,
        explanation: 'A certificate warning can indicate an incorrectly configured or intercepted connection. Do not send sensitive information through it.',
      },
    ],
  },
  {
    id: 'incident-response',
    title: 'Respond with a clear plan',
    category: 'Incident response',
    description: 'Learn what to do after a suspicious sign-in, lost device, or malware alert.',
    duration: 8,
    level: 'Intermediate',
    icon: 'alert',
    color: '#f8e6e2',
    lessons: [
      {
        title: 'Contain the problem calmly',
        body: 'If you suspect malware, stop sensitive activity and disconnect the affected device from networks when practical. For a work or school device, contact the designated support or security team and follow its process instead of trying to investigate or wipe the device yourself.',
      },
      {
        title: 'Secure accounts from a trusted device',
        body: 'Use a different device you trust to change compromised passwords, revoke unfamiliar sessions, and check recovery details. Start with your email account if it can reset other accounts, and contact your bank promptly through a known number if financial information may be affected.',
      },
      {
        title: 'Preserve details and recover carefully',
        body: 'Record what happened, when you noticed it, and any relevant messages without opening suspicious files again. Recover using trusted support and clean, tested backups; verify that the cause has been addressed before reconnecting a device or restoring normal use.',
      },
    ],
    quiz: [
      {
        question: 'You suspect malware on a work laptop. What should you do first?',
        options: [
          'Upload work files to a public forum for advice.',
          'Stop sensitive activity and contact your designated support or security team.',
          'Wipe the device immediately without telling anyone.',
        ],
        correct: 1,
        explanation: 'Report promptly and follow your organization’s response process. It may need to preserve evidence and coordinate containment.',
      },
      {
        question: 'Where should you change passwords after a device may have been compromised?',
        options: [
          'On a different device you trust.',
          'Only in a private window on the suspect device.',
          'In a reply to the suspicious email.',
        ],
        correct: 0,
        explanation: 'Use a trusted device so malware on the affected one cannot capture the replacement credentials. Also review sessions and recovery settings.',
      },
      {
        question: 'What makes a backup useful during recovery?',
        options: [
          'It has never been tested and is always writable from the affected device.',
          'It contains only shortcuts to your original files.',
          'It is protected from the incident and you have verified that files can be restored.',
        ],
        correct: 2,
        explanation: 'Backups need protection from deletion or encryption and a tested restoration path. A backup that cannot be restored cannot support recovery.',
      },
    ],
  },
];

export type ChecklistItem = {
  id: string;
  title: string;
  description: string;
  category: 'Accounts' | 'Devices' | 'Network' | 'Recovery';
};

export const checklistItems: ChecklistItem[] = [
  {
    id: 'unique-passwords',
    title: 'Use unique passwords for important accounts',
    description: 'Store long, unique passwords in a reputable password manager. Start with email, banking, and the password manager itself.',
    category: 'Accounts',
  },
  {
    id: 'enable-mfa',
    title: 'Enable MFA or passkeys',
    description: 'Protect important accounts with passkeys, security keys, or an authenticator app where supported.',
    category: 'Accounts',
  },
  {
    id: 'review-account-access',
    title: 'Review account sessions and recovery details',
    description: 'Sign out unfamiliar sessions, remove unused connected apps, and confirm that recovery email addresses and phone numbers are yours.',
    category: 'Accounts',
  },
  {
    id: 'automatic-updates',
    title: 'Turn on automatic security updates',
    description: 'Check your operating system, browser, and apps. Replace unsupported software that no longer receives security fixes.',
    category: 'Devices',
  },
  {
    id: 'screen-lock',
    title: 'Set a screen lock and strong unlock code',
    description: 'Enable automatic locking on computers and phones, and lock them whenever you step away.',
    category: 'Devices',
  },
  {
    id: 'disk-encryption',
    title: 'Check that device encryption is enabled',
    description: 'Enable full-disk encryption where supported and keep its recovery key in a secure, separate place.',
    category: 'Devices',
  },
  {
    id: 'secure-wifi',
    title: 'Use WPA3 or WPA2-AES on home Wi-Fi',
    description: 'Choose a strong Wi-Fi password and avoid obsolete WEP or an open home network.',
    category: 'Network',
  },
  {
    id: 'router-settings',
    title: 'Review your router administrator settings',
    description: 'Replace default administrator credentials, install firmware updates, and disable remote administration if you do not need it.',
    category: 'Network',
  },
  {
    id: 'tested-backup',
    title: 'Make a backup and test a restore',
    description: 'Keep a protected backup separate from your main device and verify you can restore a sample file.',
    category: 'Recovery',
  },
  {
    id: 'recovery-plan',
    title: 'Store recovery codes and support contacts',
    description: 'Keep account recovery codes securely, note trusted support contacts, and know whom to contact if a device or account is compromised.',
    category: 'Recovery',
  },
];

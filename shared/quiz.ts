import type { QuizQuestion } from './types';

export const quizQuestions: QuizQuestion[] = [
  {
    id: 'quiz-nist',
    topic: 'NIST CSF 2.0',
    question: 'Which list contains all six functions of the NIST Cybersecurity Framework 2.0?',
    options: [
      'Govern, Identify, Protect, Detect, Respond, Recover',
      'Discover, Scan, Exploit, Persist, Evade, Report',
      'Plan, Purchase, Install, Monitor, Archive, Delete',
      'Identify, Encrypt, Authenticate, Backup, Patch, Audit',
    ],
    correct: 0,
    explanation: 'CSF 2.0 organizes cybersecurity outcomes into Govern, Identify, Protect, Detect, Respond, and Recover. Using a checklist alone does not establish compliance or certification.',
  },
  {
    id: 'quiz-tcp',
    topic: 'Network fundamentals',
    question: 'A scoped TCP connection to the local lab port succeeds. What does that establish?',
    options: [
      'The service has no vulnerabilities.',
      'Every port on the host is open.',
      'A TCP listener accepted the connection on that host and port at that time.',
      'The operating system firewall is disabled.',
    ],
    correct: 2,
    explanation: 'A successful TCP connection establishes reachability to a listener. It does not identify every service, assess vulnerabilities, or prove that a firewall is disabled.',
  },
  {
    id: 'quiz-phishing',
    topic: 'Phishing awareness',
    question: 'An urgent email links to an HTTPS sign-in page and asks you to approve an unexpected MFA prompt. What should you do?',
    options: [
      'Approve the prompt because HTTPS guarantees a legitimate website.',
      'Deny the prompt and verify the request through the official service using a trusted route.',
      'Reply with your recovery codes so support can verify your account.',
      'Forward your password to a colleague to test the link.',
    ],
    correct: 1,
    explanation: 'Deny unexpected MFA requests and verify independently. HTTPS protects the connection but does not prove that a website or message is legitimate.',
  },
  {
    id: 'quiz-containment',
    topic: 'Incident response',
    question: 'In this simulation, what does the Isolate asset action actually do?',
    options: [
      'It disconnects the remote device from its real network.',
      'It deletes every suspicious file on the endpoint.',
      'It changes the operating system firewall on your computer.',
      'It updates the modeled asset state and creates an audit record; real containment requires authorized infrastructure controls.',
    ],
    correct: 3,
    explanation: 'AEGIS actions are local simulations. A real incident response team must use approved endpoint or network controls, consider business impact, and preserve evidence as appropriate.',
  },
  {
    id: 'quiz-privilege',
    topic: 'Least privilege',
    question: 'Which action best follows the principle of least privilege?',
    options: [
      'Give users and services only the access required for their tasks, and review that access regularly.',
      'Give every employee permanent administrator access.',
      'Share one administrator password across the whole team.',
      'Disable access reviews once a user signs in successfully.',
    ],
    correct: 0,
    explanation: 'Least privilege limits permissions to the access needed for a specific role or task. Regular reviews and time-limited elevated access reduce unnecessary exposure.',
  },
];

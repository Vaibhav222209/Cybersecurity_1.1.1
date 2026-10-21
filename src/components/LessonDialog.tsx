import { useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, RotateCcw, Trophy, XCircle } from 'lucide-react';
import type { LearningModule } from '../data/learning';
import Modal from './Modal';

export default function LessonDialog({ module, onClose, onResult }: {
  module: LearningModule; onClose: () => void; onResult: (module: LearningModule, score: number) => void;
}) {
  const [view, setView] = useState<'lesson' | 'quiz' | 'result'>('lesson');
  const [lesson, setLesson] = useState(0);
  const [question, setQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const currentQuestion = module.quiz[question];
  const selected = answers[question];
  const score = answers.reduce((total, answer, index) => total + Number(answer === module.quiz[index].correct), 0);
  const passed = score >= 2;
  const nextQuestion = () => {
    if (question < module.quiz.length - 1) setQuestion(question + 1);
    else { onResult(module, score); setView('result'); }
  };
  const resetQuiz = () => { setAnswers([]); setQuestion(0); setView('quiz'); };
  return <Modal title={module.title} onClose={onClose} wide>
    {view === 'lesson' && <div className="lesson-body">
      <div className="lesson-meta"><span><BookOpen size={15} /> QUICK LESSON</span><span>{lesson + 1} of {module.lessons.length}</span></div>
      <div className="step-track" aria-label={`Lesson ${lesson + 1} of ${module.lessons.length}`}>
        {module.lessons.map((entry, index) => <span className={index <= lesson ? 'filled' : ''} key={entry.title} />)}
      </div>
      <div className="lesson-reading"><span className="lesson-number">0{lesson + 1}</span><h3>{module.lessons[lesson].title}</h3><p>{module.lessons[lesson].body}</p></div>
      <div className="lesson-tip"><ShieldNote /><p>One useful habit is worth more than a hundred good intentions. Put this lesson into practice today.</p></div>
      <div className="modal-actions"><button className="button button-light" disabled={lesson === 0} onClick={() => setLesson(lesson - 1)}><ArrowLeft size={16} /> Back</button>
        <button className="button button-dark" onClick={() => lesson < module.lessons.length - 1 ? setLesson(lesson + 1) : resetQuiz()}>
          {lesson < module.lessons.length - 1 ? 'Next lesson' : 'Take the quiz'}<ArrowRight size={16} />
        </button></div>
    </div>}
    {view === 'quiz' && <div className="lesson-body">
      <div className="lesson-meta"><span>KNOWLEDGE CHECK</span><span>Question {question + 1} of {module.quiz.length}</span></div>
      <div className="step-track">{module.quiz.map((entry, index) => <span className={index <= question ? 'filled' : ''} key={entry.question} />)}</div>
      <h3 className="quiz-question">{currentQuestion.question}</h3>
      <div className="quiz-options">{currentQuestion.options.map((option, index) => {
        const answered = selected !== undefined;
        const isCorrect = index === currentQuestion.correct;
        const className = answered && isCorrect ? 'option-correct' : answered && index === selected ? 'option-incorrect' : '';
        return <button key={option} className={`quiz-option ${className}`} disabled={answered} onClick={() => setAnswers([...answers, index])}>
          <span className="option-letter">{String.fromCharCode(65 + index)}</span><span>{option}</span>
          {answered && isCorrect && <Check size={18} />}
          {answered && index === selected && !isCorrect && <XCircle size={18} />}
        </button>;
      })}</div>
      {selected !== undefined && <div className={`quiz-feedback ${selected === currentQuestion.correct ? 'correct' : ''}`} role="status">
        <strong>{selected === currentQuestion.correct ? 'Exactly right.' : 'A useful thing to learn.'}</strong><p>{currentQuestion.explanation}</p>
      </div>}
      <div className="modal-actions"><span className="muted small">Answer 2 of 3 correctly to complete this module.</span><button className="button button-dark" disabled={selected === undefined} onClick={nextQuestion}>{question < module.quiz.length - 1 ? 'Next question' : 'See results'}<ArrowRight size={16} /></button></div>
    </div>}
    {view === 'result' && <div className="quiz-result">
      <div className={`result-icon ${passed ? 'passed' : ''}`}>{passed ? <Trophy size={35} /> : <BookOpen size={35} />}</div>
      <span className="eyebrow">{passed ? 'MODULE COMPLETE' : 'KEEP PRACTICING'}</span>
      <h3>{passed ? 'A little wiser. A little safer.' : 'Every attempt is a step forward.'}</h3>
      <p>You answered <strong>{score} of {module.quiz.length}</strong> questions correctly.{passed ? ' You’ve completed this module.' : ' Review the lessons and try again. You need 2 correct answers to pass.'}</p>
      <div className="result-actions"><button className="button button-light" onClick={resetQuiz}><RotateCcw size={16} />Try again</button><button className="button button-dark" onClick={passed ? onClose : () => { setLesson(0); setView('lesson'); }}>{passed ? 'Keep exploring' : 'Review lessons'}<ArrowRight size={16} /></button></div>
    </div>}
  </Modal>;
}

function ShieldNote() { return <CheckCircle2 size={22} aria-hidden="true" />; }

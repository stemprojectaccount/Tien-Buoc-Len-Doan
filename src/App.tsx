import React, { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  onSnapshot,
  orderBy,
  Timestamp,
  getDocFromServer,
  deleteDoc
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User as FirebaseUser,
  signOut
} from 'firebase/auth';
import { db, auth, storage } from './firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import html2canvas from 'html2canvas';
import { 
  LogOut, 
  User as UserIcon, 
  BookOpen, 
  CheckCircle, 
  XCircle, 
  ChevronRight, 
  History, 
  ShieldCheck,
  ClipboardList,
  AlertCircle,
  Trophy,
  X,
  Eye,
  Camera,
  FileDown,
  ChevronLeft,
  Trash2,
  ShieldAlert,
  Maximize
} from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';

// --- Types ---
interface UserProfile {
  uid: string;
  name: string;
  birthDate: string;
  class: '9A' | '9B' | '9C' | '9D';
  role: 'student' | 'admin';
}

const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

interface QuizQuestion {
  id: number;
  type: 'multiple-choice' | 'essay';
  question: string;
  options?: string[];
  correctAnswer?: string;
  explanation: string;
  wordLimit?: number;
}

interface QuizResult {
  id: string;
  uid: string;
  studentName: string;
  studentBirthDate: string;
  studentClass: string;
  answers: { [key: number]: string };
  score: number;
  timestamp: string;
  note?: string;
  screenshotUrl?: string;
}

// --- Constants ---
const CLASSES = ['9A', '9B', '9C', '9D'] as const;

const QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    type: 'multiple-choice',
    question: 'Bài ca chính thức của Đoàn TNCS Hồ Chí Minh là:',
    options: ['Thanh niên làm theo lời Bác', 'Tiến lên đoàn viên', 'Tuổi trẻ thế hệ Bác Hồ', 'Lên đàng'],
    correctAnswer: 'Thanh niên làm theo lời Bác',
    explanation: 'Bài hát "Thanh niên làm theo lời Bác" (nhạc và lời của nhạc sĩ Hoàng Hòa) là bài ca chính thức của Đoàn.'
  },
  {
    id: 2,
    type: 'multiple-choice',
    question: 'Đoàn TNCS Hồ Chí Minh tổ chức và hoạt động theo nguyên tắc nào?',
    options: ['Tự do cá nhân', 'Tập trung dân chủ', 'Tự quản', 'Hiệp thương'],
    correctAnswer: 'Tập trung dân chủ',
    explanation: 'Nguyên tắc tập trung dân chủ là nguyên tắc tổ chức và hoạt động cơ bản của Đoàn.'
  },
  {
    id: 3,
    type: 'multiple-choice',
    question: 'Đoàn TNCS Hồ Chí Minh được thành lập vào thời gian nào?',
    options: ['26/3/1930', '26/3/1931', '2/9/1945', '3/2/1930'],
    correctAnswer: '26/3/1931',
    explanation: 'Ngày 26/3/1931 là ngày thành lập Đoàn TNCS Đông Dương (nay là Đoàn TNCS Hồ Chí Minh).'
  },
  {
    id: 4,
    type: 'multiple-choice',
    question: 'Tên gọi đầu tiên của Đoàn Thanh niên Cộng sản Hồ Chí Minh là gì?',
    options: ['Đoàn TNCS Việt Nam', 'Đoàn TNCS Đông Dương', 'Đoàn TN Phản đế Đông Dương', 'Đoàn TN Dân chủ Đông Dương'],
    correctAnswer: 'Đoàn TNCS Đông Dương',
    explanation: 'Tên gọi đầu tiên của Đoàn là Đoàn Thanh niên Cộng sản Đông Dương.'
  },
  {
    id: 5,
    type: 'multiple-choice',
    question: 'Cơ quan lãnh đạo cao nhất của Đoàn TNCS Hồ Chí Minh là gì?',
    options: ['Đại hội Đoàn toàn quốc', 'Ban Chấp hành', 'Ban Thường vụ', 'Đoàn cơ sở'],
    correctAnswer: 'Đại hội Đoàn toàn quốc',
    explanation: 'Cơ quan lãnh đạo cao nhất của Đoàn là Đại hội đại biểu toàn quốc.'
  },
  {
    id: 6,
    type: 'multiple-choice',
    question: 'Màu sắc chủ đạo của huy hiệu Đoàn TNCS Hồ Chí Minh là gì?',
    options: ['Màu xanh', 'Màu đỏ', 'Màu vàng', 'Màu trắng'],
    correctAnswer: 'Màu đỏ',
    explanation: 'Huy hiệu Đoàn có hình tròn, trên nền xanh lam là hình ảnh một cánh tay nắm chắc lá cờ Tổ quốc (màu đỏ) đang tung bay.'
  },
  {
    id: 7,
    type: 'multiple-choice',
    question: 'Đoàn viên thanh niên cần có những phẩm chất nào sau đây?',
    options: ['Thờ ơ, thiếu trách nhiệm', 'Năng động, có trách nhiệm trong học tập và hoạt động', 'Chỉ quan tâm đến bản thân', 'Ngại tham gia các hoạt động tập thể'],
    correctAnswer: 'Năng động, có trách nhiệm trong học tập và hoạt động',
    explanation: 'Đoàn viên cần gương mẫu, năng động và có trách nhiệm trong mọi hoạt động.'
  },
  {
    id: 8,
    type: 'multiple-choice',
    question: 'Cơ quan lãnh đạo cao nhất của chi đoàn là gì?',
    options: ['Ban Chấp hành chi đoàn', 'Đại hội đoàn viên', 'Đoàn cấp trên', 'Bí thư chi đoàn'],
    correctAnswer: 'Đại hội đoàn viên',
    explanation: 'Cơ quan lãnh đạo cao nhất của chi đoàn là Đại hội đoàn viên.'
  },
  {
    id: 9,
    type: 'multiple-choice',
    question: 'Theo Điều lệ Đoàn TNCS Hồ Chí Minh, đoàn viên có bao nhiêu nhiệm vụ?',
    options: ['3', '4', '5', '6'],
    correctAnswer: '3',
    explanation: 'Theo Điều lệ Đoàn, đoàn viên có 3 nhiệm vụ chính.'
  },
  {
    id: 10,
    type: 'multiple-choice',
    question: 'Đâu là việc làm đúng của một đoàn viên thanh niên?',
    options: ['Tham gia tích cực các hoạt động tập thể', 'Trốn tránh nhiệm vụ được giao', 'Không quan tâm đến tập thể', 'Vi phạm nội quy'],
    correctAnswer: 'Tham gia tích cực các hoạt động tập thể',
    explanation: 'Đoàn viên có nhiệm vụ tham gia tích cực vào các hoạt động của tổ chức Đoàn.'
  },
  {
    id: 11,
    type: 'multiple-choice',
    question: 'Thanh niên trong độ tuổi nào thì đủ điều kiện được kết nạp vào Đoàn TNCS Hồ Chí Minh?',
    options: ['Từ 14 đến 30 tuổi', 'Từ 15 đến 30 tuổi', 'Từ 16 đến 30 tuổi', 'Từ 18 đến 30 tuổi'],
    correctAnswer: 'Từ 16 đến 30 tuổi',
    explanation: 'Công dân Việt Nam từ đủ 16 tuổi đến 30 tuổi có đủ điều kiện theo Điều lệ Đoàn sẽ được kết nạp.'
  },
  {
    id: 12,
    type: 'multiple-choice',
    question: 'Những nội dung nào sau đây thể hiện truyền thống của Đoàn TNCS Hồ Chí Minh?',
    options: ['Trung thành với lý tưởng cách mạng', 'Không ngừng rèn luyện, cống hiến', 'Xung kích, sáng tạo trong hoạt động', 'Cả 3 đáp án trên'],
    correctAnswer: 'Cả 3 đáp án trên',
    explanation: 'Đoàn có truyền thống trung thành tuyệt đối, xung kích sáng tạo và không ngừng rèn luyện.'
  },
  {
    id: 13,
    type: 'multiple-choice',
    question: 'Tháng Thanh niên hằng năm được tổ chức vào tháng nào?',
    options: ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4'],
    correctAnswer: 'Tháng 3',
    explanation: 'Tháng 3 hằng năm được chọn là Tháng Thanh niên.'
  },
  {
    id: 14,
    type: 'multiple-choice',
    question: 'Khẩu hiệu nào sau đây thể hiện rõ tinh thần xung kích của thanh niên Việt Nam?',
    options: ['Học, học nữa, học mãi', 'Đâu cần thanh niên có, việc gì khó có thanh niên', 'Tiên học lễ, hậu học văn', 'Sống và làm việc theo pháp luật'],
    correctAnswer: 'Đâu cần thanh niên có, việc gì khó có thanh niên',
    explanation: 'Đây là khẩu hiệu hành động thể hiện tinh thần sẵn sàng cống hiến của thanh niên.'
  },
  {
    id: 15,
    type: 'multiple-choice',
    question: 'Hiện nay, ai là Bí thư thứ nhất Trung ương Đoàn TNCS Hồ Chí Minh?',
    options: ['Vũ Trọng Kim', 'Nguyễn Lam', 'Bùi Quang Huy', 'Vũ Mão'],
    correctAnswer: 'Bùi Quang Huy',
    explanation: 'Đồng chí Bùi Quang Huy hiện là Bí thư thứ nhất Trung ương Đoàn TNCS Hồ Chí Minh khóa XII.'
  },
  {
    id: 16,
    type: 'multiple-choice',
    question: 'Đoàn TNCS Hồ Chí Minh là đội dự bị tin cậy của tổ chức nào?',
    options: ['Nhà nước', 'Chính phủ', 'Đảng Cộng sản Việt Nam', 'Quốc hội'],
    correctAnswer: 'Đảng Cộng sản Việt Nam',
    explanation: 'Đoàn là đội dự bị tin cậy, là cánh tay đắc lực của Đảng Cộng sản Việt Nam.'
  },
  {
    id: 17,
    type: 'multiple-choice',
    question: 'Đảng Cộng sản Việt Nam là tổ chức đại diện cho lợi ích của ai?',
    options: ['Người giàu', 'Nhân dân lao động và dân tộc Việt Nam', 'Học sinh', 'Doanh nghiệp'],
    correctAnswer: 'Nhân dân lao động và dân tộc Việt Nam',
    explanation: 'Đảng đại diện cho lợi ích của giai cấp công nhân, nhân dân lao động và của cả dân tộc.'
  },
  {
    id: 18,
    type: 'multiple-choice',
    question: 'Đảng Cộng sản Việt Nam được thành lập vào ngày nào?',
    options: ['2/9/1945', '3/2/1930', '26/3/1931', '30/4/1975'],
    correctAnswer: '3/2/1930',
    explanation: 'Ngày 3/2/1930 là ngày thành lập Đảng Cộng sản Việt Nam.'
  },
  {
    id: 19,
    type: 'multiple-choice',
    question: 'Ai là người sáng lập Đảng Cộng sản Việt Nam?',
    options: ['Võ Nguyên Giáp', 'Phạm Văn Đồng', 'Hồ Chí Minh', 'Trường Chinh'],
    correctAnswer: 'Hồ Chí Minh',
    explanation: 'Chủ tịch Hồ Chí Minh là người sáng lập và rèn luyện Đảng Cộng sản Việt Nam.'
  },
  {
    id: 20,
    type: 'multiple-choice',
    question: 'Mục tiêu phấn đấu của nhiều đoàn viên thanh niên là gì?',
    options: ['Trở nên giàu có', ' Được nổi tiếng', 'Phấn đấu trở thành đảng viên Đảng Cộng sản Việt Nam', 'Không có mục tiêu'],
    correctAnswer: 'Phấn đấu trở thành đảng viên Đảng Cộng sản Việt Nam',
    explanation: 'Phấn đấu trở thành Đảng viên là mục tiêu cao cả của những đoàn viên ưu tú.'
  },
  {
    id: 21,
    type: 'essay',
    question: 'Nêu lý do bạn muốn phấn đấu trở thành Đoàn viên TNCS Hồ Chí Minh',
    wordLimit: 300,
    explanation: 'Câu trả lời cần thể hiện được nhận thức về vai trò của Đoàn, lý tưởng cách mạng và mong muốn được rèn luyện, cống hiến trong tổ chức Đoàn.'
  }
];

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string;
    emailVerified?: boolean;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email || undefined,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Components ---
const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      try {
        const parsed = JSON.parse(e.message);
        if (parsed.error) setError(parsed.error);
      } catch {
        setError(e.message);
      }
    };
    const handleRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      if (reason && typeof reason === 'object' && reason.message) {
        try {
          const parsed = JSON.parse(reason.message);
          if (parsed.error) {
            setError(parsed.error);
            return;
          }
        } catch {
          // Not JSON
        }
        setError(reason.message);
      } else {
        setError(String(reason));
      }
    };
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="bg-white p-6 rounded-2xl shadow-xl max-w-md w-full border border-red-100">
          <div className="flex items-center gap-3 text-red-600 mb-4">
            <AlertCircle size={24} />
            <h2 className="text-xl font-bold">Đã xảy ra lỗi</h2>
          </div>
          <p className="text-gray-600 mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
          >
            Tải lại trang
          </button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
};

export default function App() {
  const quizContainerRef = React.useRef<HTMLDivElement>(null);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'home' | 'quiz' | 'history' | 'admin'>('home');
  
  // Registration state
  const [regName, setRegName] = useState('');
  const [regBirthDate, setRegBirthDate] = useState('');
  const [regClass, setRegClass] = useState<UserProfile['class']>('9A');

  // Quiz state
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<{ [key: number]: string }>(() => {
    const saved = localStorage.getItem('quiz_progress');
    return saved ? JSON.parse(saved) : {};
  });
  const [shuffledOptions, setShuffledOptions] = useState<{ [key: number]: string[] }>(() => {
    const saved = localStorage.getItem('shuffled_options');
    return saved ? JSON.parse(saved) : {};
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFullscreenSupported, setIsFullscreenSupported] = useState(true);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Save progress to localStorage
  useEffect(() => {
    if (Object.keys(answers).length > 0) {
      localStorage.setItem('quiz_progress', JSON.stringify(answers));
    }
  }, [answers]);

  useEffect(() => {
    if (Object.keys(shuffledOptions).length > 0) {
      localStorage.setItem('shuffled_options', JSON.stringify(shuffledOptions));
    }
  }, [shuffledOptions]);

  // Admin/History state
  const [results, setResults] = useState<QuizResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<QuizResult | null>(null);

  const handleDeleteResult = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa kết quả này không?')) return;
    try {
      await deleteDoc(doc(db, 'results', id));
      // results will be updated automatically by onSnapshot
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `results/${id}`);
    }
  };

  const downloadWordReport = async (result: QuizResult) => {
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              text: "BÁO CÁO KẾT QUẢ BÀI THI",
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({ text: "" }),
            new Paragraph({
              children: [
                new TextRun({ text: `Họ và tên: `, bold: true }),
                new TextRun({ text: result.studentName }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: `Ngày sinh: `, bold: true }),
                new TextRun({ text: result.studentBirthDate }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: `Lớp: `, bold: true }),
                new TextRun({ text: result.studentClass }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: `Điểm trắc nghiệm: `, bold: true }),
                new TextRun({ text: `${result.score}/${QUESTIONS.filter(q => q.type === 'multiple-choice').length}` }),
              ],
            }),
            ...(result.note ? [
              new Paragraph({
                children: [
                  new TextRun({ text: `Ghi chú: `, bold: true, color: "FF0000" }),
                  new TextRun({ text: result.note, color: "FF0000", italics: true }),
                ],
              }),
            ] : []),
            new Paragraph({
              children: [
                new TextRun({ text: `Thời gian nộp bài: `, bold: true }),
                new TextRun({ text: new Date(result.timestamp).toLocaleString('vi-VN') }),
              ],
            }),
            new Paragraph({ text: "" }),
            new Paragraph({
              text: "CHI TIẾT BÀI LÀM",
              heading: HeadingLevel.HEADING_2,
            }),
            new Paragraph({ text: "" }),
            ...QUESTIONS.flatMap((q) => [
              new Paragraph({
                children: [
                  new TextRun({ text: `Câu ${q.id}: ${q.question}`, bold: true }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: `Câu trả lời: `, bold: true }),
                  new TextRun({ 
                    text: result.answers[q.id] || '(Bỏ trống)',
                    color: q.type === 'multiple-choice' 
                      ? (result.answers[q.id] === q.correctAnswer ? "008000" : "FF0000")
                      : "0000FF"
                  }),
                ],
              }),
              ...(q.type === 'multiple-choice' ? [
                new Paragraph({
                  children: [
                    new TextRun({ text: `Đáp án đúng: `, bold: true }),
                    new TextRun({ text: q.correctAnswer || '', italics: true }),
                  ],
                })
              ] : []),
              new Paragraph({ text: "" }),
            ]),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `KetQua_${result.studentName.replace(/\s+/g, '_')}_${result.studentClass}.docx`);
  };

  // --- Session Management ---
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    const checkSession = async () => {
      const savedProfile = localStorage.getItem('student_profile');
      if (savedProfile) {
        const parsed = JSON.parse(savedProfile) as UserProfile;
        setProfile(parsed);
        // Also check if they are logged in as admin
        onAuthStateChanged(auth, (u) => {
          setUser(u);
          if (u && u.email === 'pn9055162@gmail.com') {
            setProfile(prev => prev ? { ...prev, role: 'admin' } : null);
          }
        });
      }
      setLoading(false);
    };
    checkSession();
  }, []);

  // --- Connection Test ---
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  // --- Data Fetching ---
  useEffect(() => {
    // Fetch results based on profile or view
    let q;
    if (view === 'admin' || profile?.role === 'admin') {
      q = query(collection(db, 'results'), orderBy('timestamp', 'desc'));
    } else if (profile) {
      q = query(collection(db, 'results'), where('uid', '==', profile.uid), orderBy('timestamp', 'desc'));
    } else {
      return;
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuizResult));
      setResults(data);
    }, (error) => {
      // If it's a permission error, it might be because they aren't admin
      console.warn('Snapshot error (possibly not admin):', error);
    });

    return unsubscribe;
  }, [profile, view]);

  // --- Actions ---
  const handleShowLeaderboard = () => {
    setView('admin');
  };

  const handleLoginAdmin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      // Profile update will happen in onAuthStateChanged or manually
      const u = auth.currentUser;
      if (u && u.email === 'pn9055162@gmail.com') {
        const adminProfile: UserProfile = {
          uid: u.uid,
          name: 'Giáo viên',
          birthDate: '1980-01-01',
          class: '9A',
          role: 'admin'
        };
        setProfile(adminProfile);
        localStorage.setItem('student_profile', JSON.stringify(adminProfile));
        setView('admin');
      }
    } catch (error) {
      console.error('Admin login error:', error);
    }
  };

  const handleRegister = async () => {
    const trimmedName = regName.trim();
    if (!trimmedName || !regBirthDate) {
      setNotification({ message: 'Vui lòng nhập đầy đủ thông tin!', type: 'info' });
      return;
    }
    setIsRegistering(true);
    
    try {
      // Check if user already exists with this name, birthDate and class
      const q = query(
        collection(db, 'users'), 
        where('name', '==', trimmedName), 
        where('birthDate', '==', regBirthDate),
        where('class', '==', regClass)
      );
      const querySnapshot = await getDocs(q);
      
      let userProfile: UserProfile;
      
      if (!querySnapshot.empty) {
        // Use existing profile
        const existingDoc = querySnapshot.docs[0];
        userProfile = existingDoc.data() as UserProfile;
        
        // Check if this user already has a result
        const resultsSnapshot = await getDocs(query(collection(db, 'results'), where('uid', '==', userProfile.uid)));
        if (!resultsSnapshot.empty) {
          setProfile(userProfile);
          localStorage.setItem('student_profile', JSON.stringify(userProfile));
          setNotification({ message: 'Em đã hoàn thành bài thi trước đó rồi!', type: 'info' });
          setView('history');
          return;
        }
        
        setNotification({ message: `Chào mừng em quay lại, ${userProfile.name}!`, type: 'success' });
      } else {
        // Create new profile
        const uid = 'anon_' + Math.random().toString(36).substr(2, 9);
        userProfile = {
          uid,
          name: trimmedName,
          birthDate: regBirthDate,
          class: regClass,
          role: 'student'
        };
        await setDoc(doc(db, 'users', uid), userProfile);
      }
      
      setProfile(userProfile);
      localStorage.setItem('student_profile', JSON.stringify(userProfile));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/lookup`);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleStartQuiz = () => {
    if (results.some(r => r.uid === profile?.uid)) {
      setNotification({ message: 'Em đã hoàn thành bài thi rồi!', type: 'info' });
      setView('history');
      return;
    }
    // Request fullscreen
    const element = document.documentElement as any;
    const requestMethod = element.requestFullscreen || 
                          element.webkitRequestFullscreen || 
                          element.mozRequestFullScreen || 
                          element.msRequestFullscreen;

    if (requestMethod) {
      requestMethod.call(element).catch((err: any) => {
        console.warn(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    }

    // We don't clear answers here anymore to support progress persistence
    // If user wants to start fresh, they can do so after submitting or logging out
    
    // Initialize shuffled options if not already done
    if (Object.keys(shuffledOptions).length === 0) {
      const newShuffled: { [key: number]: string[] } = {};
      QUESTIONS.forEach(q => {
        if (q.type === 'multiple-choice' && q.options) {
          newShuffled[q.id] = shuffleArray(q.options);
        }
      });
      setShuffledOptions(newShuffled);
    }

    setCurrentStep(0);
    setView('quiz');
  };

  const handleSubmitQuiz = useCallback(async (forcedScore?: number, note?: string) => {
    if (!profile || isSubmitting) return;
    setIsSubmitting(true);
    
    // Calculate score for multiple choice
    let score = 0;
    if (forcedScore !== undefined) {
      score = forcedScore;
    } else {
      QUESTIONS.forEach(q => {
        if (q.type === 'multiple-choice' && answers[q.id] === q.correctAnswer) {
          score++;
        }
      });
    }

    const result: Omit<QuizResult, 'id'> = {
      uid: profile.uid,
      studentName: profile.name,
      studentBirthDate: profile.birthDate,
      studentClass: profile.class,
      answers,
      score,
      timestamp: new Date().toISOString(),
      note: note || "" // Firestore doesn't allow undefined
    };

    try {
      // Capture screenshot if not cheating (if cheating, we might not have the container or it might be hidden)
      let screenshotUrl = '';
      if (!note && quizContainerRef.current) {
        try {
          const canvas = await html2canvas(quizContainerRef.current, {
            useCORS: true,
            scale: 1,
            logging: false,
            backgroundColor: '#f8fafc',
            onclone: (clonedDoc) => {
              // Workaround for oklch colors which html2canvas doesn't support
              // We'll replace them with safe fallbacks in the cloned document
              const styleTags = clonedDoc.getElementsByTagName('style');
              for (let i = 0; i < styleTags.length; i++) {
                const tag = styleTags[i];
                if (tag.innerHTML.includes('oklch')) {
                  // Replace oklch(...) with a simple gray color to prevent parser error
                  tag.innerHTML = tag.innerHTML.replace(/oklch\([^)]+\)/g, '#cbd5e1');
                }
              }
              const style = clonedDoc.createElement('style');
              style.innerHTML = `
                .bg-slate-50 { background-color: #f8fafc !important; }
                .bg-white { background-color: #ffffff !important; }
                .text-slate-900 { color: #0f172a !important; }
                .text-slate-500 { color: #64748b !important; }
                .text-blue-600 { color: #2563eb !important; }
                .border-slate-100 { border-color: #f1f5f9 !important; }
              `;
              clonedDoc.head.appendChild(style);
            }
          });
          const imageData = canvas.toDataURL('image/jpeg', 0.6);
          const screenshotRef = ref(storage, `screenshots/${profile.uid}_${Date.now()}.jpg`);
          await uploadString(screenshotRef, imageData, 'data_url');
          screenshotUrl = await getDownloadURL(screenshotRef);
        } catch (err) {
          console.error('Screenshot capture failed:', err);
        }
      }

      const finalResult = { ...result, screenshotUrl };
      const resultRef = doc(collection(db, 'results'));
      await setDoc(resultRef, finalResult);
      localStorage.removeItem('quiz_progress');
      localStorage.removeItem('shuffled_options');
      setAnswers({});
      setShuffledOptions({});
      
      // Exit fullscreen if we were in it
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }

      if (note) {
        setNotification({ 
          message: 'Cảnh báo: Phát hiện hành vi gian lận! Bài thi đã bị hủy và tính 0 điểm.', 
          type: 'info' 
        });
        setView('home');
      } else {
        setSelectedResult({ id: resultRef.id, ...finalResult });
        setView('history');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'results');
    } finally {
      setIsSubmitting(false);
    }
  }, [profile, isSubmitting, answers, db, setView, setSelectedResult, setNotification]);

  // Prevent accidental exit during quiz
  useEffect(() => {
    const doc = document as any;
    const supported = !!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled || doc.mozFullScreenEnabled || doc.msFullscreenEnabled);
    setIsFullscreenSupported(supported);

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (view === 'quiz') {
        e.preventDefault();
        e.returnValue = 'Bạn đang trong quá trình làm bài. Bạn có chắc chắn muốn thoát?';
        return e.returnValue;
      }
    };

    // Kick out if they already have a result but are in quiz view
    if (view === 'quiz' && profile && results.some(r => r.uid === profile.uid)) {
      setView('home');
      setNotification({ message: 'Em đã hoàn thành bài thi rồi!', type: 'info' });
    }

    const handleFullscreenChange = () => {
      const isFull = !!(doc.fullscreenElement || 
                        doc.webkitFullscreenElement || 
                        doc.mozFullScreenElement || 
                        doc.msFullscreenElement);
      setIsFullscreen(isFull);
      
      // Check if an input is focused - keyboard popup on mobile can trigger exit
      const activeEl = document.activeElement;
      const isInputFocused = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

      if (view === 'quiz' && !isFull && !isInputFocused) {
        // Auto-submit with 0 score if cheating detected
        handleSubmitQuiz(0, 'gian lận xài ai trong lúc làm');
      }
    };

    const handleVisibilityChange = () => {
      if (view === 'quiz' && document.visibilityState === 'hidden') {
        // Auto-submit with 0 score if user switches tabs
        handleSubmitQuiz(0, 'gian lận xài ai trong lúc làm');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [view, handleSubmitQuiz]);

  const handleLogout = () => {
    localStorage.removeItem('student_profile');
    localStorage.removeItem('quiz_progress');
    setProfile(null);
    setAnswers({});
    signOut(auth);
    setView('home');
  };

  // --- Render Helpers ---
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!profile && view !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 overflow-x-hidden">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-100 overflow-hidden"
        >
          <div className="relative bg-white">
            <img 
              src="https://i.postimg.cc/wv5GXLcY/z7636268845552_ebe5719428f26261e75d485ce4957fcc.jpg" 
              alt="Banner" 
              className="w-full h-auto block"
              referrerPolicy="no-referrer"
            />
          </div>
          
          <div className="p-8 pt-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shrink-0">
                <UserIcon className="text-white" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 leading-tight">Tiến Bước Lên Đoàn</h2>
                <p className="text-slate-500 text-xs font-medium">Nhập thông tin để bắt đầu làm bài</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Họ và tên</label>
                <input 
                  type="text" 
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Nhập họ và tên của em"
                  autoComplete="name"
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Ngày sinh</label>
                <input 
                  type="text" 
                  value={regBirthDate}
                  onChange={(e) => setRegBirthDate(e.target.value)}
                  placeholder="VD: 20/03/2010"
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Lớp</label>
                <div className="grid grid-cols-4 gap-2">
                  {CLASSES.map(c => (
                    <button
                      key={c}
                      onClick={() => setRegClass(c)}
                      className={`py-3 rounded-xl font-bold transition-all active:scale-95 ${
                        regClass === c 
                          ? 'bg-blue-600 text-white shadow-md' 
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <button 
                onClick={handleRegister}
                disabled={!regName || !regBirthDate || isRegistering}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed mt-4 active:scale-95 flex items-center justify-center gap-2"
              >
                {isRegistering ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  'Vào làm bài'
                )}
              </button>

              <div className="pt-6 border-t border-slate-100">
                <button 
                  onClick={handleShowLeaderboard}
                  className="w-full py-2 text-slate-400 hover:text-blue-600 text-xs font-bold uppercase tracking-widest transition-all"
                >
                  Xem Lịch Sử & Xếp Hạng
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900 overflow-x-hidden">
        {/* Fullscreen Overlay for Quiz */}
        {view === 'quiz' && isFullscreenSupported && !isFullscreen && (
          <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-6 text-center">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="max-w-md w-full bg-white rounded-3xl p-8 shadow-2xl border border-slate-100"
            >
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center text-red-600 mx-auto mb-6">
                <ShieldAlert size={40} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">Chế độ toàn màn hình bị tắt</h2>
              <p className="text-slate-600 mb-8 leading-relaxed">
                Để đảm bảo tính công bằng và bảo mật cho bài thi, em vui lòng quay lại chế độ toàn màn hình để tiếp tục làm bài.
              </p>
              <button
                onClick={() => {
                  const element = document.documentElement as any;
                  const requestMethod = element.requestFullscreen || 
                                        element.webkitRequestFullscreen || 
                                        element.mozRequestFullScreen || 
                                        element.msRequestFullscreen;
                  if (requestMethod) {
                    requestMethod.call(element).catch((err: any) => {
                      console.error(`Error re-enabling fullscreen: ${err.message}`);
                    });
                  }
                }}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95 flex items-center justify-center gap-2"
              >
                <Maximize size={20} />
                Quay lại toàn màn hình
              </button>
              
              {/* Emergency skip for buggy mobile browsers */}
              <button 
                onClick={() => setIsFullscreen(true)}
                className="mt-6 text-slate-400 hover:text-slate-600 text-xs underline underline-offset-4"
              >
                Tiếp tục mà không cần toàn màn hình (nếu bị lỗi)
              </button>
            </motion.div>
          </div>
        )}

        {/* Navigation - Hidden during quiz */}
        {view !== 'quiz' && (
          <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
            <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('home')}>
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <BookOpen className="text-white" size={18} />
                </div>
                <span className="font-bold text-lg hidden sm:block">Tiến Bước Lên Đoàn</span>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 bg-white border border-blue-200 rounded-full px-3 py-1.5 shadow-sm">
                  <button 
                    onClick={() => setView('history')}
                    className={`p-1.5 rounded-lg transition-all ${view === 'history' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-blue-600 hover:bg-slate-50'}`}
                    title="Lịch sử"
                  >
                    <History size={20} />
                  </button>
                  {(profile?.role === 'admin' || view === 'admin') && (
                    <>
                      <div className="w-[1px] h-4 bg-slate-200 mx-0.5"></div>
                      <button 
                        onClick={() => setView('admin')}
                        className={`p-1.5 rounded-lg transition-all ${view === 'admin' ? 'bg-purple-50 text-purple-600' : 'text-slate-400 hover:text-purple-600 hover:bg-slate-50'}`}
                        title="Quản trị"
                      >
                        <ShieldCheck size={20} />
                      </button>
                    </>
                  )}
                </div>
                <div className="h-8 w-[1px] bg-slate-200 mx-1"></div>
                <div className="flex items-center gap-2">
                  {profile ? (
                    <>
                      <div className="text-right hidden xs:block">
                        <p className="text-xs font-bold leading-tight">{profile.name}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">{profile.class}</p>
                      </div>
                      <button 
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border border-slate-100 hover:border-red-100 font-medium"
                      >
                        <LogOut size={20} />
                        <span className="hidden sm:inline">Đăng xuất</span>
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={() => setView('home')}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-bold shadow-sm active:scale-95"
                    >
                      <UserIcon size={18} />
                      <span>Quay lại</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </nav>
        )}

        {/* Notification Toast */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] px-6 py-3 bg-blue-600 text-white rounded-full shadow-xl font-bold flex items-center gap-2"
            >
              <CheckCircle size={18} />
              {notification.message}
            </motion.div>
          )}
        </AnimatePresence>

        <main className="max-w-5xl mx-auto p-4 sm:p-6">
          <AnimatePresence mode="wait">
            {view === 'home' && (
              <motion.div 
                key="home"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="relative rounded-3xl overflow-hidden shadow-2xl bg-white">
                  <img 
                    src="https://i.postimg.cc/wv5GXLcY/z7636268845552_ebe5719428f26261e75d485ce4957fcc.jpg" 
                    alt="Tiến Bước Lên Đoàn" 
                    className="w-full h-auto block"
                    referrerPolicy="no-referrer"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between">
                    <div>
                      <h3 className="text-2xl font-bold mb-4">
                        {results.some(r => r.uid === profile?.uid) 
                          ? 'Bài thi đã hoàn thành' 
                          : (Object.keys(answers).length > 0 ? 'Tiếp tục bài làm' : 'Bắt đầu kiểm tra')}
                      </h3>
                      <p className="text-slate-500 mb-6">
                        {results.some(r => r.uid === profile?.uid)
                          ? 'Em đã nộp bài thi rồi. Em có thể xem lại kết quả trong phần Lịch sử.'
                          : (Object.keys(answers).length > 0 
                            ? `Em đang làm dở bài thi (${Object.keys(answers).length}/${QUESTIONS.length} câu).` 
                            : 'Thử thách bản thân với các câu hỏi trắc nghiệm và tự luận về Đoàn.')}
                      </p>
                    </div>
                    {results.some(r => r.uid === profile?.uid) ? (
                      <button 
                        onClick={() => setView('history')}
                        className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                      >
                        <History size={20} />
                        Xem lịch sử bài làm
                      </button>
                    ) : (
                      <button 
                        onClick={handleStartQuiz}
                        className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                      >
                        {Object.keys(answers).length > 0 ? 'Tiếp tục ngay' : 'Bắt đầu ngay'} <ChevronRight size={20} />
                      </button>
                    )}
                  </div>
                  
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between">
                    <div>
                      <h3 className="text-2xl font-bold mb-4">Lịch sử của em</h3>
                      <p className="text-slate-500 mb-6">Xem lại các bài làm cũ, điểm số và lời giải thích chi tiết.</p>
                    </div>
                    <button 
                      onClick={() => setView('history')}
                      className="w-full py-4 bg-slate-100 text-slate-900 rounded-2xl font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                    >
                      Xem lịch sử <History size={20} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'quiz' && (
              <motion.div 
                key="quiz"
                ref={quizContainerRef}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-2xl mx-auto"
              >
                <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
                  {/* Enhanced Progress Indicator */}
                  <div className="bg-slate-50 border-b border-slate-100 p-4">
                    <div className="flex justify-between items-center mb-4 px-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-sm">
                          {currentStep + 1}
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Đang làm câu</p>
                          <p className="text-sm font-bold text-slate-900 leading-none">{currentStep + 1} / {QUESTIONS.length}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Tiến độ</p>
                        <p className="text-sm font-bold text-blue-600 leading-none">{Math.round(((Object.keys(answers).length) / QUESTIONS.length) * 100)}%</p>
                      </div>
                    </div>
                    
                    <div className="h-1.5 bg-slate-200 w-full rounded-full overflow-hidden mb-4">
                      <motion.div 
                        className="h-full bg-blue-600"
                        initial={{ width: 0 }}
                        animate={{ width: `${((currentStep + 1) / QUESTIONS.length) * 100}%` }}
                      />
                    </div>

                    <div className="flex flex-wrap gap-1.5 justify-center">
                      {QUESTIONS.map((q, idx) => (
                        <button
                          key={q.id}
                          onClick={() => setCurrentStep(idx)}
                          className={`w-7 h-7 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center border ${
                            currentStep === idx 
                              ? 'bg-blue-600 border-blue-600 text-white shadow-md scale-110 z-10' 
                              : answers[q.id] 
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-600' 
                                : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                          }`}
                        >
                          {idx + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="p-8">
                    <div className="flex justify-between items-center mb-6">
                      <div className="flex items-center gap-2">
                        {QUESTIONS[currentStep].type === 'multiple-choice' ? (
                          <div className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-[10px] font-black uppercase tracking-widest">Trắc nghiệm</div>
                        ) : (
                          <div className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-[10px] font-black uppercase tracking-widest">Tự luận</div>
                        )}
                      </div>
                      {QUESTIONS[currentStep].type === 'essay' && (
                        <div className="flex items-center gap-1.5 text-purple-600">
                          <AlertCircle size={14} />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Câu hỏi quan trọng</span>
                        </div>
                      )}
                    </div>

                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-8 leading-tight">
                      {QUESTIONS[currentStep].question}
                    </h2>

                    {QUESTIONS[currentStep].type === 'multiple-choice' ? (
                      <div className="space-y-3">
                        {(shuffledOptions[QUESTIONS[currentStep].id] || QUESTIONS[currentStep].options || []).map((option, idx) => (
                          <button
                            key={idx}
                            onClick={() => setAnswers({ ...answers, [QUESTIONS[currentStep].id]: option })}
                            className={`w-full text-left p-5 rounded-2xl border-2 transition-all flex items-center justify-between group ${
                              answers[QUESTIONS[currentStep].id] === option
                                ? 'border-blue-600 bg-blue-50 text-blue-900'
                                : 'border-slate-100 hover:border-slate-200 text-slate-600'
                            }`}
                          >
                            <span className="font-medium">{option}</span>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                              answers[QUESTIONS[currentStep].id] === option
                                ? 'border-blue-600 bg-blue-600'
                                : 'border-slate-200'
                            }`}>
                              {answers[QUESTIONS[currentStep].id] === option && <CheckCircle size={14} className="text-white" />}
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <textarea
                          value={answers[QUESTIONS[currentStep].id] || ''}
                          onChange={(e) => {
                            const text = e.target.value;
                            const words = text.trim().split(/\s+/).filter(w => w.length > 0);
                            const limit = QUESTIONS[currentStep].wordLimit || 300;
                            
                            if (words.length <= limit || text.length < (answers[QUESTIONS[currentStep].id] || '').length) {
                              setAnswers({ ...answers, [QUESTIONS[currentStep].id]: text });
                            }
                          }}
                          placeholder="Nhập câu trả lời của em tại đây..."
                          className="w-full h-48 p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-600 focus:ring-0 outline-none transition-all resize-none font-medium"
                        />
                        <div className="flex justify-between items-center px-2">
                          <p className="text-xs text-slate-400">
                            Giới hạn: <span className="font-bold">{QUESTIONS[currentStep].wordLimit || 300} từ</span>
                          </p>
                          <p className={`text-xs font-bold ${
                            (answers[QUESTIONS[currentStep].id] || '').trim().split(/\s+/).filter(w => w.length > 0).length > (QUESTIONS[currentStep].wordLimit || 300)
                              ? 'text-red-500'
                              : 'text-slate-400'
                          }`}>
                            {(answers[QUESTIONS[currentStep].id] || '').trim().split(/\s+/).filter(w => w.length > 0).length} / {QUESTIONS[currentStep].wordLimit || 300} từ
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="mt-10 flex flex-col gap-4">
                      {QUESTIONS[currentStep].type === 'essay' && (
                        <div className="p-4 bg-purple-50 border border-purple-100 rounded-2xl flex items-start gap-3">
                          <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 shrink-0">
                            <ShieldCheck size={18} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-purple-900 mb-0.5">Lời khuyên dành cho em</p>
                            <p className="text-xs text-purple-700 leading-relaxed">Hãy trình bày suy nghĩ của mình một cách chân thành nhất. Đây là phần quan trọng để thầy cô hiểu thêm về tâm tư, nguyện vọng của em.</p>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-3">
                        {currentStep > 0 && (
                          <button 
                            onClick={() => setCurrentStep(currentStep - 1)}
                            className="flex-1 py-4 bg-slate-100 text-slate-900 rounded-2xl font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                          >
                            <ChevronLeft size={20} />
                            Quay lại
                          </button>
                        )}
                        {currentStep < QUESTIONS.length - 1 ? (
                          <button 
                            onClick={() => setCurrentStep(currentStep + 1)}
                            disabled={!answers[QUESTIONS[currentStep].id]}
                            className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            Tiếp theo
                            <ChevronRight size={20} />
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleSubmitQuiz()}
                            disabled={isSubmitting || !answers[QUESTIONS[currentStep].id]}
                            className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-200"
                          >
                            {isSubmitting ? (
                              <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Đang nộp bài...
                              </>
                            ) : (
                              <>
                                <CheckCircle size={20} />
                                Hoàn thành & Nộp bài
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'history' && (
              <motion.div 
                key="history"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setView('home')}
                      className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-500 flex items-center gap-1"
                      title="Quay lại"
                    >
                      <ChevronLeft size={24} />
                      <span className="text-sm font-bold hidden sm:inline">Quay lại</span>
                    </button>
                    <h2 className="text-2xl font-bold">Lịch sử làm bài</h2>
                  </div>
                  <button 
                    onClick={handleStartQuiz}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all"
                  >
                    Làm bài mới
                  </button>
                </div>

                {results.length === 0 ? (
                  <div className="bg-white p-12 rounded-3xl text-center border border-slate-100">
                    <ClipboardList size={48} className="mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500">Em chưa có bài làm nào. Hãy bắt đầu ngay!</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest">Thời gian</th>
                            <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest">Điểm TN</th>
                            <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest">Hành động</th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.map((result) => (
                            <tr key={result.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                              <td className="p-4">
                                <p className="font-bold text-slate-900">{new Date(result.timestamp).toLocaleString('vi-VN')}</p>
                              </td>
                              <td className="p-4">
                                <p className="font-black text-blue-600">{result.score}/{QUESTIONS.filter(q => q.type === 'multiple-choice').length}</p>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <button 
                                    onClick={() => setSelectedResult(result)}
                                    className="text-blue-600 hover:text-blue-800 text-sm font-bold flex items-center gap-1"
                                  >
                                    Chi tiết <ChevronRight size={14} />
                                  </button>
                                  <button 
                                    onClick={() => downloadWordReport(result)}
                                    className="p-2 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-600 rounded-lg transition-colors"
                                    title="Tải về file Word"
                                  >
                                    <FileDown size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {view === 'admin' && (
              <motion.div 
                key="admin"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setView('home')}
                      className="p-2 hover:bg-white hover:shadow-md rounded-xl transition-all text-slate-600 border border-transparent hover:border-slate-100"
                      title="Quay lại"
                    >
                      <ChevronLeft size={24} />
                    </button>
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight">Bảng Thành Tích</h2>
                      <p className="text-slate-500 text-sm font-medium">Vinh danh những nỗ lực xuất sắc của học sinh</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="px-4 py-2 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-2">
                      <Trophy size={16} className="text-amber-500" />
                      <span className="text-sm font-bold text-slate-700">Tổng số: {results.length}</span>
                    </div>
                  </div>
                </div>

                {/* Top 3 Spotlight */}
                {results.length >= 3 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {results
                      .slice()
                      .sort((a, b) => {
                        if (b.score !== a.score) return b.score - a.score;
                        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
                      })
                      .slice(0, 3)
                      .map((res, idx) => {
                        const colors = [
                          { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: 'text-amber-500', shadow: 'shadow-amber-100' },
                          { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', icon: 'text-slate-400', shadow: 'shadow-slate-100' },
                          { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', icon: 'text-orange-500', shadow: 'shadow-orange-100' }
                        ][idx];
                        
                        return (
                          <motion.div
                            key={res.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.1 }}
                            className={`${colors.bg} ${colors.border} ${colors.shadow} border-2 rounded-[2rem] p-6 relative overflow-hidden shadow-xl flex flex-col items-center text-center group cursor-pointer hover:scale-[1.02] transition-transform`}
                            onClick={() => setSelectedResult(res)}
                          >
                            <div className="absolute top-4 right-4">
                              <Trophy className={colors.icon} size={24} />
                            </div>
                            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg mb-4 border-4 border-white">
                              <span className={`text-3xl font-black ${colors.text}`}>{idx + 1}</span>
                            </div>
                            <h4 className="text-lg font-black text-slate-900 mb-1 line-clamp-1">
                              {res.studentName}
                              {res.note && (
                                <span className="ml-1 text-[8px] text-red-500 font-bold italic">({res.note})</span>
                              )}
                            </h4>
                            <div className="flex items-center gap-2 mb-4">
                              <span className="px-2 py-0.5 bg-white/50 rounded-lg text-[10px] font-black uppercase text-slate-600 border border-white/50">Lớp {res.studentClass}</span>
                              <span className={`text-sm font-black ${colors.text}`}>{res.score} điểm</span>
                            </div>
                            <button className="text-xs font-bold text-slate-500 group-hover:text-slate-900 transition-colors flex items-center gap-1">
                              Xem chi tiết <ChevronRight size={12} />
                            </button>
                          </motion.div>
                        );
                      })}
                  </div>
                )}

                <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                  <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                    <h3 className="font-black text-slate-400 uppercase tracking-widest text-xs">Danh sách xếp hạng</h3>
                    <div className="flex gap-2">
                      {CLASSES.map(c => (
                        <div key={c} className="w-2 h-2 rounded-full bg-slate-200"></div>
                      ))}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/30">
                          <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest w-20 text-center">Hạng</th>
                          <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Học sinh</th>
                          <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ngày sinh</th>
                          <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Lớp</th>
                          <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Điểm TN</th>
                          <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest hidden md:table-cell">Thời gian</th>
                          <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Hành động</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results
                          .slice()
                          .sort((a, b) => {
                            if (b.score !== a.score) return b.score - a.score;
                            return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
                          })
                          .map((res, idx) => (
                          <tr 
                            key={res.id} 
                            className={`group border-b border-slate-50 hover:bg-blue-50/40 transition-all cursor-pointer ${idx < 3 ? 'bg-blue-50/10' : ''}`}
                            onClick={() => setSelectedResult(res)}
                          >
                            <td className="p-6">
                              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm mx-auto transition-all group-hover:scale-110 shadow-sm ${
                                idx === 0 ? 'bg-amber-400 text-white shadow-amber-200' :
                                idx === 1 ? 'bg-slate-400 text-white shadow-slate-200' :
                                idx === 2 ? 'bg-orange-400 text-white shadow-orange-200' :
                                'bg-white border border-slate-200 text-slate-400'
                              }`}>
                                {idx + 1}
                              </div>
                            </td>
                            <td className="p-6">
                              <div className="flex flex-col">
                                <p className="font-black text-slate-900 group-hover:text-blue-600 transition-colors text-base">
                                  {res.studentName}
                                  {res.note && (
                                    <span className="ml-2 text-[10px] text-red-500 font-bold italic">({res.note})</span>
                                  )}
                                </p>
                                {idx < 3 && (
                                  <span className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${
                                    idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-slate-500' : 'text-orange-500'
                                  }`}>
                                    Top {idx + 1} Xuất sắc
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-6">
                              <span className="text-sm font-bold text-slate-600">
                                {res.studentBirthDate}
                              </span>
                            </td>
                            <td className="p-6">
                              <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors border border-slate-200/50">
                                {res.studentClass}
                              </span>
                            </td>
                            <td className="p-6">
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                  <span>Tiến độ</span>
                                  <span className="text-blue-600">
                                    {Math.round((res.score / QUESTIONS.filter(q => q.type === 'multiple-choice').length) * 100)}%
                                  </span>
                                </div>
                                <div className="h-2 w-32 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(res.score / QUESTIONS.filter(q => q.type === 'multiple-choice').length) * 100}%` }}
                                    className={`h-full rounded-full ${
                                      idx === 0 ? 'bg-amber-400' : idx === 1 ? 'bg-slate-400' : idx === 2 ? 'bg-orange-400' : 'bg-blue-600'
                                    }`}
                                  />
                                </div>
                                <span className="font-black text-slate-900 text-sm">
                                  {res.score} / {QUESTIONS.filter(q => q.type === 'multiple-choice').length}
                                </span>
                              </div>
                            </td>
                            <td className="p-6 text-[11px] text-slate-400 font-bold hidden md:table-cell">
                              <div className="flex flex-col">
                                <span>{new Date(res.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                                <span className="text-[10px] opacity-60">{new Date(res.timestamp).toLocaleDateString('vi-VN')}</span>
                              </div>
                            </td>
                            <td className="p-6">
                              <div className="flex items-center justify-end gap-2">
                                {res.screenshotUrl && (
                                  <a 
                                    href={res.screenshotUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 rounded-2xl transition-all shadow-sm hover:shadow-md active:scale-95"
                                    title="Xem minh chứng (Ảnh chụp màn hình)"
                                  >
                                    <Camera size={18} />
                                  </a>
                                )}
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    downloadWordReport(res);
                                  }}
                                  className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 rounded-2xl transition-all shadow-sm hover:shadow-md active:scale-95"
                                  title="Tải về file Word"
                                >
                                  <FileDown size={18} />
                                </button>
                                {profile?.role === 'admin' && (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteResult(res.id);
                                    }}
                                    className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 rounded-2xl transition-all shadow-sm hover:shadow-md active:scale-95"
                                    title="Xóa kết quả"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Detail Modal Overlay - Shared by Admin and History */}
            <AnimatePresence>
              {selectedResult && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                  onClick={() => setSelectedResult(null)}
                >
                  <motion.div 
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 20 }}
                    className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <div>
                        <h3 className="text-2xl font-black text-slate-900 mb-1">
                          {selectedResult.studentName}
                          {selectedResult.note && (
                            <span className="ml-2 text-xs text-red-500 font-bold italic">({selectedResult.note})</span>
                          )}
                        </h3>
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-600 rounded-lg text-[10px] font-black uppercase border border-blue-200">Lớp {selectedResult.studentClass}</span>
                          <span className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">{new Date(selectedResult.timestamp).toLocaleString('vi-VN')}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => downloadWordReport(selectedResult)}
                          className="p-3 bg-blue-600 text-white hover:bg-blue-700 rounded-2xl transition-all flex items-center gap-2 text-xs font-black shadow-lg shadow-blue-100 active:scale-95"
                        >
                          <FileDown size={18} />
                          TẢI WORD
                        </button>
                        <button 
                          onClick={() => setSelectedResult(null)}
                          className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-2xl transition-all active:scale-95"
                        >
                          <X size={20} />
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-8 space-y-10">
                      <div className="grid grid-cols-2 gap-6">
                        <div className="p-6 bg-blue-50/50 rounded-[2rem] border-2 border-blue-100 text-center shadow-sm">
                          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Điểm trắc nghiệm</p>
                          <p className="text-4xl font-black text-blue-900">{selectedResult.score}/{QUESTIONS.filter(q => q.type === 'multiple-choice').length}</p>
                        </div>
                        <div className="p-6 bg-slate-50/50 rounded-[2rem] border-2 border-slate-100 text-center shadow-sm">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Xếp hạng</p>
                          <p className="text-4xl font-black text-slate-900">
                            #{results.slice().sort((a,b) => b.score - a.score).findIndex(r => r.id === selectedResult.id) + 1}
                          </p>
                        </div>
                      </div>

                      {selectedResult.screenshotUrl && (
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="h-px flex-1 bg-slate-100"></div>
                            <h4 className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Ảnh chụp màn hình (Minh chứng)</h4>
                            <div className="h-px flex-1 bg-slate-100"></div>
                          </div>
                          <div className="rounded-3xl overflow-hidden border-4 border-slate-100 shadow-xl bg-slate-50 group relative">
                            <img 
                              src={selectedResult.screenshotUrl} 
                              alt="Screenshot minh chứng" 
                              className="w-full h-auto block transition-transform duration-500 group-hover:scale-105"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none"></div>
                            <a 
                              href={selectedResult.screenshotUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="absolute bottom-4 right-4 p-3 bg-white/90 backdrop-blur-md rounded-2xl shadow-xl text-slate-900 font-black text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0"
                            >
                              Xem ảnh gốc
                            </a>
                          </div>
                        </div>
                      )}

                      <div className="space-y-8">
                        <div className="flex items-center gap-3">
                          <div className="h-px flex-1 bg-slate-100"></div>
                          <h4 className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Chi tiết câu trả lời</h4>
                          <div className="h-px flex-1 bg-slate-100"></div>
                        </div>
                        <div className="space-y-6">
                          {QUESTIONS.map((q) => (
                            <div key={q.id} className="bg-slate-50/30 rounded-3xl p-6 border border-slate-100/50">
                              <div className="flex items-start gap-4 mb-4">
                                <span className="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-xs font-black text-slate-400 shrink-0 mt-0.5 shadow-sm">{q.id}</span>
                                <p className="font-black text-slate-800 text-lg leading-snug">{q.question}</p>
                              </div>
                              
                              <div className="ml-9 space-y-3">
                                <div className={`p-4 rounded-2xl ${
                                  q.type === 'multiple-choice' 
                                    ? selectedResult.answers[q.id] === q.correctAnswer 
                                      ? 'bg-green-50 text-green-800 border border-green-100' 
                                      : 'bg-red-50 text-red-800 border border-red-100'
                                    : 'bg-blue-50 text-blue-800 border border-blue-100'
                                }`}>
                                  <p className="text-[10px] uppercase font-black opacity-60 mb-1">Câu trả lời của học sinh</p>
                                  <p className="font-medium">{selectedResult.answers[q.id] || '(Bỏ trống)'}</p>
                                </div>

                                {q.type === 'multiple-choice' && selectedResult.answers[q.id] !== q.correctAnswer && (
                                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <p className="text-[10px] uppercase font-black text-slate-400 mb-1">Đáp án đúng</p>
                                    <p className="font-bold text-slate-700">{q.correctAnswer}</p>
                                  </div>
                                )}
                                
                                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                                  <p className="text-[10px] uppercase font-black text-amber-600 mb-1">Giải thích</p>
                                  <div className="text-sm text-amber-900 leading-relaxed">
                                    <Markdown>{q.explanation}</Markdown>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </AnimatePresence>
        </main>
      </div>
    </ErrorBoundary>
  );
}

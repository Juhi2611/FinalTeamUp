// =============================================================
// components/interviews/InterviewRouter.tsx
// Routes to VideoInterview or QuizInterview based on type
// This is what gets rendered from InterviewDashboard
// =============================================================

import VideoInterview from './VideoInterview';
import QuizInterview from './QuizInterview';
import { InterviewRequest } from '@/services/firestore_interviews';

interface Props {
  request: InterviewRequest;
  onEnd: () => void;
}

const InterviewRouter = ({ request, onEnd }: Props) => {
  if (request.type === 'video') {
    return <VideoInterview request={request} onEnd={onEnd} />;
  }
  return <QuizInterview request={request} onEnd={onEnd} />;
};

export default InterviewRouter;

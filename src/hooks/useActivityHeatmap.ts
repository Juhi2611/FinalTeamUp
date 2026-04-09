import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/lib/firebase';

/**
 * Hook that fetches real user activity data for the heatmap.
 * Sources: tasks completed (verified), posts created, teams joined/invited.
 * Returns an array of 91 numbers (13 weeks × 7 days), each 0–4 intensity.
 */
export function useActivityHeatmap(userId: string | undefined) {
  const [cells, setCells] = useState<number[]>(new Array(91).fill(0));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !isFirebaseConfigured()) {
      setCells(new Array(91).fill(0));
      setLoading(false);
      return;
    }

    const fetchActivity = async () => {
      try {
        const now = new Date();
        const ninetyOneDaysAgo = new Date(now);
        ninetyOneDaysAgo.setDate(now.getDate() - 90);
        ninetyOneDaysAgo.setHours(0, 0, 0, 0);

        const startTimestamp = Timestamp.fromDate(ninetyOneDaysAgo);

        const activityMap: Record<number, number> = {};

        const getDayIndex = (date: Date): number => {
          // Normalize both dates to midnight to avoid millisecond math errors
          const d1 = new Date(date.getFullYear(), date.getMonth(), date.getDate());
          const d2 = new Date(ninetyOneDaysAgo.getFullYear(), ninetyOneDaysAgo.getMonth(), ninetyOneDaysAgo.getDate());

          const diffTime = d1.getTime() - d2.getTime();
          return Math.floor(diffTime / (1000 * 60 * 60 * 24));
        };

        // ✅ ONLY VALID TYPES
        const validTypes = [
          "task_assigned",
          "task_submitted",
          "task_verified",
          "team_created"
        ];

        // ✅ WEIGHTS (for glow intensity)
        const weights: Record<string, number> = {
          task_assigned: 1,
          task_submitted: 2,
          task_verified: 3,
          team_created: 4
        };

        // 🔥 SINGLE SOURCE: activity collection
        const activityQuery = query(
          collection(db, "activity"),
          where("userId", "==", userId)
        );

        const snap = await getDocs(activityQuery);

        snap.docs.forEach(doc => {
          const data = doc.data();

          if (!validTypes.includes(data.type)) return;

          const date = data.createdAt?.toDate?.();
          if (!date || date < ninetyOneDaysAgo) return;

          const idx = getDayIndex(date);
          if (idx < 0 || idx >= 91) return;

          activityMap[idx] = (activityMap[idx] || 0) + (weights[data.type] || 1);
        });

        // 🎨 Convert to heat levels
        const result: number[] = [];

        for (let i = 0; i < 91; i++) {
          const count = activityMap[i] || 0;

          let level = 0;
          if (count === 0) level = 0;
          else if (count <= 2) level = 1;
          else if (count <= 5) level = 2;
          else if (count <= 8) level = 3;
          else level = 4;

          result.push(level);
        }

        setCells(result);

      } catch (err) {
        console.error('Heatmap fetch error:', err);
        setCells(new Array(91).fill(0));
      }

      setLoading(false);
    };

    fetchActivity();
  }, [userId]);

  return { cells, loading };
}

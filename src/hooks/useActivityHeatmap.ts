// hooks/useActivityHeatmap.ts
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/lib/firebase';

export function useActivityHeatmap(userId: string | undefined) {
  const [cells, setCells] = useState<number[]>(new Array(98).fill(0));
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date | null>(null);

  useEffect(() => {
    if (!userId || !isFirebaseConfigured()) {
      console.log('[Heatmap] Skipping fetch — userId:', userId, '| Firebase configured:', isFirebaseConfigured());
      setCells(new Array(98).fill(0));
      setLoading(false);
      return;
    }

    const fetchActivity = async () => {
      try {
        // "Today" at midnight — the authoritative reference point for all date math.
        const todayMidnight = new Date();
        todayMidnight.setHours(0, 0, 0, 0);

        // Find the most recent Sunday (start of current week).
        const currentSunday = new Date(todayMidnight);
        currentSunday.setDate(todayMidnight.getDate() - todayMidnight.getDay());

        // Go back 13 more weeks → 14 columns total (98 cells).
        const gridStartDate = new Date(currentSunday);
        gridStartDate.setDate(currentSunday.getDate() - 13 * 7);

        setStartDate(gridStartDate);

        console.log('[Heatmap] userId:', userId);
        console.log('[Heatmap] gridStartDate:', gridStartDate.toDateString());
        console.log('[Heatmap] today:', todayMidnight.toDateString());

        // Fetch all activity docs from gridStartDate onward for this user.
        const activityQuery = query(
          collection(db, 'activity'),
          where('userId', '==', userId),
          where('createdAt', '>=', Timestamp.fromDate(gridStartDate))
        );

        const snap = await getDocs(activityQuery);

        console.log('[Heatmap] docs fetched:', snap.size);

        // Log every doc so we can see the actual shape of the data.
        snap.docs.forEach((doc, idx) => {
          const d = doc.data();
          console.log(`[Heatmap] doc[${idx}]`, {
            id: doc.id,
            type: d.type,
            userId: d.userId,
            createdAt: d.createdAt?.toDate?.()?.toDateString?.() ?? d.createdAt,
            raw: d,
          });
        });

        // Weight map — covers both snake_case and camelCase variants so a naming
        // mismatch in Firestore doesn't silently zero everything out.
        const weights: Record<string, number> = {
          // snake_case
          task_assigned: 1,
          task_submitted: 2,
          task_verified: 3,
          team_created: 4,
          // camelCase variants (in case Firestore uses these)
          taskAssigned: 1,
          taskSubmitted: 2,
          taskVerified: 3,
          teamCreated: 4,
        };

        const activityMap: Record<number, number> = {};

        snap.docs.forEach((doc) => {
          const data = doc.data();
          const date: Date | undefined = data.createdAt?.toDate?.();
          if (!date) {
            console.warn('[Heatmap] doc missing createdAt date:', doc.id);
            return;
          }

          // Normalise to midnight to avoid DST/timezone drift.
          const dateMidnight = new Date(date);
          dateMidnight.setHours(0, 0, 0, 0);

          const diffMs = dateMidnight.getTime() - gridStartDate.getTime();
          const dayIndex = Math.round(diffMs / (1000 * 60 * 60 * 24));

          const weight = weights[data.type] ?? 1; // default weight 1 for any unknown type
          console.log(`[Heatmap] doc "${doc.id}" → type: "${data.type}", dayIndex: ${dayIndex}, weight: ${weight}`);

          if (dayIndex >= 0 && dayIndex < 98) {
            activityMap[dayIndex] = (activityMap[dayIndex] || 0) + weight;
          } else {
            console.warn(`[Heatmap] dayIndex ${dayIndex} out of range for doc "${doc.id}"`);
          }
        });

        console.log('[Heatmap] activityMap (non-zero days):',
          Object.fromEntries(Object.entries(activityMap).filter(([, v]) => v > 0))
        );

        // Build the 98-element levels array.
        const result: number[] = [];
        for (let i = 0; i < 98; i++) {
          const count = activityMap[i] || 0;
          let level = 0;
          if (count === 0)      level = 0;
          else if (count <= 2)  level = 1;
          else if (count <= 5)  level = 2;
          else if (count <= 8)  level = 3;
          else                  level = 4;
          result.push(level);
        }

        console.log('[Heatmap] non-zero cells:', result.filter(Boolean).length);
        setCells(result);
      } catch (err) {
        console.error('[Heatmap] fetch error:', err);
        setCells(new Array(98).fill(0));
      } finally {
        setLoading(false);
      }
    };

    fetchActivity();
  }, [userId]);

  return { cells, loading, startDate };
}
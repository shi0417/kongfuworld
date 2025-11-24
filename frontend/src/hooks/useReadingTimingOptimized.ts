// 优化版阅读时间追踪Hook
import { useState, useEffect, useRef, useCallback } from 'react';

interface ReadingTimingData {
  enterTime: Date;
  exitTime: Date;
  duration: number;
}

interface UseReadingTimingOptimizedOptions {
  recordId: number | null;
  onTimingUpdate?: (data: ReadingTimingData) => void;
  heartbeatInterval?: number; // 心跳间隔，默认60秒
  minDuration?: number; // 最小停留时间，默认30秒
}

export const useReadingTimingOptimized = ({ 
  recordId, 
  onTimingUpdate,
  heartbeatInterval = 180000, // 改为180秒
  minDuration = 30 // 最小30秒才发送心跳
}: UseReadingTimingOptimizedOptions) => {
  const [enterTime, setEnterTime] = useState<Date | null>(null);
  const [exitTime, setExitTime] = useState<Date | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastHeartbeatRef = useRef<Date | null>(null);
  const isPageVisibleRef = useRef(true);

  // 智能心跳检测
  const sendHeartbeat = useCallback(async (currentDuration: number) => {
    if (!recordId || currentDuration < minDuration) return;
    
    // 检查页面是否可见
    if (!isPageVisibleRef.current) return;
    
    // 检查是否在最近发送过心跳
    const now = new Date();
    if (lastHeartbeatRef.current && 
        (now.getTime() - lastHeartbeatRef.current.getTime()) < (heartbeatInterval / 2)) {
      return;
    }
    
    try {
      // 使用优化版API
      const response = await fetch('/api/reading-timing/heartbeat-optimized', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId, currentDuration })
      });
      
      if (response.ok) {
        lastHeartbeatRef.current = now;
        console.log(`💓 智能心跳发送: 记录${recordId}, 时长${currentDuration}秒`);
      }
    } catch (error) {
      console.error('心跳发送失败:', error);
    }
  }, [recordId, heartbeatInterval, minDuration]);

  // 开始追踪
  const startTracking = useCallback(() => {
    if (isTracking || !recordId) return;
    
    const now = new Date();
    setEnterTime(now);
    setIsTracking(true);
    lastHeartbeatRef.current = now;
    
    console.log(`📖 开始智能追踪: 记录${recordId}`);
    
    // 设置智能心跳检测
    intervalRef.current = setInterval(() => {
      if (enterTime) {
        const currentDuration = Math.floor((Date.now() - enterTime.getTime()) / 1000);
        sendHeartbeat(currentDuration);
      }
    }, heartbeatInterval);
  }, [isTracking, recordId, enterTime, sendHeartbeat, heartbeatInterval]);

  // 停止追踪
  const stopTracking = useCallback(async () => {
    if (!isTracking || !enterTime) return;
    
    const now = new Date();
    const calculatedDuration = Math.floor((now.getTime() - enterTime.getTime()) / 1000);
    
    setExitTime(now);
    setDuration(calculatedDuration);
    setIsTracking(false);
    
    // 清除心跳检测
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    console.log(`📖 停止智能追踪: 记录${recordId}, 总时长${calculatedDuration}秒`);
    
    // 触发最终更新
    if (onTimingUpdate && calculatedDuration >= minDuration) {
      onTimingUpdate({
        enterTime,
        exitTime: now,
        duration: calculatedDuration
      });
    }
  }, [isTracking, enterTime, recordId, onTimingUpdate, minDuration]);

  // 页面可见性检测
  useEffect(() => {
    const handleVisibilityChange = () => {
      isPageVisibleRef.current = !document.hidden;
      
      if (document.hidden) {
        console.log('📱 页面不可见，暂停心跳');
      } else {
        console.log('📱 页面可见，恢复心跳');
        if (isTracking && enterTime) {
          startTracking();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isTracking, enterTime, startTracking]);

  // 页面离开事件
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isTracking) {
        stopTracking();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      stopTracking();
    };
  }, [isTracking, stopTracking]);

  // 自动开始追踪
  useEffect(() => {
    if (recordId && !isTracking) {
      startTracking();
    }
  }, [recordId, isTracking, startTracking]);

  return {
    enterTime,
    exitTime,
    duration,
    isTracking,
    startTracking,
    stopTracking
  };
};

import type {
  AutoAssignInput,
  StaffInfo,
  AvailabilityPattern,
  TimeOffRequest,
  ShiftRequirement,
  ExistingShift,
} from "@/lib/gemini/types";

// APIレスポンスの型定義
interface StaffApiResponse {
  id: string;
  name: string;
  hourlyWage: number;
}

interface AvailabilityApiResponse {
  id: string;
  staffId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface TimeOffApiResponse {
  id: string;
  staffId: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  status: "pending" | "approved" | "rejected";
}

interface RequirementApiResponse {
  id: string;
  dayOfWeek: number;
  hour: number;
  requiredCount: number;
}

interface ShiftApiResponse {
  id: string;
  staffId: string;
  date: string;
  startTime: string;
  endTime: string;
  staff: {
    id: string;
    name: string;
  };
}

// 日付から曜日を取得
export function getDayOfWeek(dateString: string): number {
  const date = new Date(dateString);
  return date.getDay(); // 0=日曜, 1=月曜, ...
}

// 自動割り振りに必要なデータを収集
export async function collectAutoAssignData(
  date: string
): Promise<AutoAssignInput> {
  const dayOfWeek = getDayOfWeek(date);

  // 並列でAPIを呼び出し
  const [staff, availabilities, timeOffRequests, requirements, existingShifts] =
    await Promise.all([
      fetchStaff(),
      fetchAvailabilities(dayOfWeek),
      fetchTimeOffRequests(date),
      fetchRequirements(dayOfWeek),
      fetchExistingShifts(date),
    ]);

  return {
    date,
    dayOfWeek,
    staff,
    availabilities,
    timeOffRequests,
    requirements,
    existingShifts,
  };
}

// スタッフ一覧を取得
async function fetchStaff(): Promise<StaffInfo[]> {
  const response = await fetch("/api/staff");
  if (!response.ok) {
    throw new Error("スタッフ情報の取得に失敗しました");
  }

  const data: StaffApiResponse[] = await response.json();
  return data.map((s) => ({
    id: s.id,
    name: s.name,
    hourlyWage: s.hourlyWage,
  }));
}

// 勤務可能時間パターンを取得（指定曜日）
async function fetchAvailabilities(
  dayOfWeek: number
): Promise<AvailabilityPattern[]> {
  const response = await fetch("/api/availability-patterns");
  if (!response.ok) {
    throw new Error("勤務可能時間の取得に失敗しました");
  }

  const data: AvailabilityApiResponse[] = await response.json();

  // 指定曜日のパターンのみフィルタ
  return data
    .filter((a) => a.dayOfWeek === dayOfWeek)
    .map((a) => ({
      staffId: a.staffId,
      dayOfWeek: a.dayOfWeek,
      startTime: a.startTime,
      endTime: a.endTime,
    }));
}

// 休み希望を取得（指定日の承認済みのみ）
async function fetchTimeOffRequests(date: string): Promise<TimeOffRequest[]> {
  const response = await fetch("/api/time-off-requests");
  if (!response.ok) {
    throw new Error("休み希望の取得に失敗しました");
  }

  const data: TimeOffApiResponse[] = await response.json();

  // 指定日の承認済み休暇のみフィルタ
  return data
    .filter((t) => t.date === date && t.status === "approved")
    .map((t) => ({
      staffId: t.staffId,
      date: t.date,
      startTime: t.startTime ?? undefined,
      endTime: t.endTime ?? undefined,
      status: t.status,
    }));
}

// シフト必要人数を取得（指定曜日）
async function fetchRequirements(
  dayOfWeek: number
): Promise<ShiftRequirement[]> {
  const response = await fetch("/api/shift-requirements");
  if (!response.ok) {
    throw new Error("必要人数の取得に失敗しました");
  }

  const data: RequirementApiResponse[] = await response.json();

  // 指定曜日の必要人数のみフィルタ
  return data
    .filter((r) => r.dayOfWeek === dayOfWeek)
    .map((r) => ({
      dayOfWeek: r.dayOfWeek,
      hour: r.hour,
      requiredCount: r.requiredCount,
    }));
}

// 既存シフトを取得（指定日）
async function fetchExistingShifts(date: string): Promise<ExistingShift[]> {
  const response = await fetch(`/api/shifts?date=${date}`);
  if (!response.ok) {
    throw new Error("既存シフトの取得に失敗しました");
  }

  const data: ShiftApiResponse[] = await response.json();

  return data.map((s) => ({
    id: s.id,
    staffId: s.staffId,
    staffName: s.staff.name,
    startTime: s.startTime,
    endTime: s.endTime,
  }));
}

// 勤務可能なスタッフをフィルタ（休暇・既存シフト考慮）
export function getAvailableStaff(
  input: AutoAssignInput
): {
  id: string;
  name: string;
  availableFrom: string;
  availableTo: string;
}[] {
  const result: {
    id: string;
    name: string;
    availableFrom: string;
    availableTo: string;
  }[] = [];

  for (const staff of input.staff) {
    // 休暇中のスタッフは除外
    const hasFullDayOff = input.timeOffRequests.some(
      (t) => t.staffId === staff.id && !t.startTime && !t.endTime
    );
    if (hasFullDayOff) continue;

    // 勤務可能時間パターンを取得
    const availability = input.availabilities.find(
      (a) => a.staffId === staff.id
    );
    if (!availability) continue;

    // 既存シフトがあるスタッフも考慮（重複しないように）
    const existingShift = input.existingShifts.find(
      (s) => s.staffId === staff.id
    );

    // 時間部分休暇を考慮
    const partialTimeOff = input.timeOffRequests.find(
      (t) => t.staffId === staff.id && t.startTime && t.endTime
    );

    // 勤務可能時間を調整
    let availableFrom = availability.startTime;
    let availableTo = availability.endTime;

    // 部分休暇がある場合は勤務可能時間を調整
    if (partialTimeOff && partialTimeOff.startTime && partialTimeOff.endTime) {
      // 簡易処理: 休暇時間帯を避ける（前半または後半のみ勤務可能）
      const offStart = partialTimeOff.startTime;
      const offEnd = partialTimeOff.endTime;

      if (availability.startTime < offStart) {
        availableTo = offStart;
      } else if (availability.endTime > offEnd) {
        availableFrom = offEnd;
      } else {
        // 勤務可能時間が完全に休暇時間内の場合はスキップ
        continue;
      }
    }

    // 既存シフトがある場合は、その時間帯を除外
    // （複雑なケースは一旦スキップ: 既存シフトがあるスタッフは除外）
    if (existingShift) {
      continue;
    }

    result.push({
      id: staff.id,
      name: staff.name,
      availableFrom,
      availableTo,
    });
  }

  return result;
}

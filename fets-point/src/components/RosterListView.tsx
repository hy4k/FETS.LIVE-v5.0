import { Schedule, StaffProfile } from '../types/shared';

interface RosterListViewProps {
  schedules: Schedule[];
  staffProfiles: StaffProfile[];
}

export function RosterListView({ schedules, staffProfiles }: RosterListViewProps) {
  const getStaffName = (profileId: string): string => {
    const staff = staffProfiles.find(s => s.id === profileId);
    return staff?.full_name || 'Unknown Staff';
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-[#0d1d1f] shadow-md rounded-lg border border-[#388087]">
        <thead className="bg-[#1a3a3d]">
          <tr>
            <th className="py-3 px-4 text-left text-sm font-semibold text-slate-400">Date</th>
            <th className="py-3 px-4 text-left text-sm font-semibold text-slate-400">Staff Name</th>
            <th className="py-3 px-4 text-left text-sm font-semibold text-slate-400">Shift</th>
            <th className="py-3 px-4 text-left text-sm font-semibold text-slate-400">Overtime</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#388087]">
          {schedules.map(schedule => (
            <tr key={schedule.id}>
              <td className="py-3 px-4 text-sm text-slate-200">{schedule.date}</td>
              <td className="py-3 px-4 text-sm text-slate-200">{getStaffName(schedule.profile_id)}</td>
              <td className="py-3 px-4 text-sm text-slate-200">{schedule.shift_code}</td>
              <td className="py-3 px-4 text-sm text-slate-200">{schedule.overtime_hours}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

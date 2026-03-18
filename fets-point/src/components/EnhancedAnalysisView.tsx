import React, { useMemo } from 'react';
import {
  BarChart3,
  Clock,
  Users,
  Calendar,
  TrendingUp,
  AlertCircle,
  Activity,
  UserCheck,
  UserX,
  Briefcase,
  Zap,
  Target,
  CheckCircle2,
  BatteryCharging
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { useBranch } from '../hooks/useBranch';
import { LeaveRequest, Schedule, StaffProfile } from '../types/shared';

interface AnalysisViewProps {
  schedules: Schedule[];
  staffProfiles: StaffProfile[];
  requests: LeaveRequest[];
  currentDate: Date;
}

export const EnhancedAnalysisView: React.FC<AnalysisViewProps> = ({
  schedules,
  staffProfiles,
  requests,
  currentDate
}) => {
  const { activeBranch } = useBranch();

  // Neumorphic Styles
  const neumorphicCard = "bg-[#1a3a3d] shadow-lg rounded-2xl border border-[#388087]";
  const neumorphicInset = "bg-[#0d1d1f] shadow-inner rounded-xl border border-[#388087]";

  // Calculate comprehensive analytics
  const analytics = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // 1. Filter Data for Current Month & Branch
    const monthlySchedules = schedules.filter(s => {
      const d = new Date(s.date);
      return d.getMonth() === month && d.getFullYear() === year;
    });

    let branchStaff = staffProfiles;
    if (activeBranch !== 'global') {
      branchStaff = staffProfiles.filter(s => s.branch_assigned === activeBranch);
    }

    const branchSchedules = monthlySchedules.filter(s =>
      branchStaff.some(staff => staff.id === s.profile_id)
    );

    // 2. Compute Individual Staff Metrics
    const staffMetrics = branchStaff.map(staff => {
      const shifts = branchSchedules.filter(s => s.profile_id === staff.id);

      const totalAssigned = shifts.length;
      const presentShifts = shifts.filter(s => !['L', 'RD', 'T'].includes(s.shift_code)).length;
      const leaveDays = shifts.filter(s => s.shift_code === 'L').length;
      const toilDays = shifts.filter(s => s.shift_code === 'TOIL').length;
      const otHours = shifts.reduce((sum, s) => sum + (s.overtime_hours || 0), 0);

      // Attendance Score: (Present / (Total - RestDays)) * 100
      const workingDays = shifts.filter(s => s.shift_code !== 'RD').length;
      const attendanceScore = workingDays > 0 ? ((presentShifts / workingDays) * 100) : 0;

      // Load Status
      let loadStatus: 'Overloaded' | 'Optimal' | 'Underutilized' = 'Optimal';
      if (otHours > 20 || totalAssigned > 26 || toilDays > 2) loadStatus = 'Overloaded';
      if (totalAssigned < 15) loadStatus = 'Underutilized';

      return {
        ...staff,
        metrics: {
          totalAssigned,
          presentShifts,
          leaveDays,
          toilDays,
          otHours,
          attendanceScore,
          loadStatus
        }
      };
    });

    // 3. Aggregate Global Metrics
    const totalScheduled = branchSchedules.length;
    const totalLeaves = branchSchedules.filter(s => s.shift_code === 'L').length;
    const totalTOIL = branchSchedules.filter(s => s.shift_code === 'TOIL').length;
    const totalOT = branchSchedules.reduce((sum, s) => sum + (s.overtime_hours || 0), 0);

    const avgAttendance = staffMetrics.length > 0
      ? staffMetrics.reduce((sum, s) => sum + s.metrics.attendanceScore, 0) / staffMetrics.length
      : 0;

    const leaveRate = totalScheduled > 0 ? (totalLeaves / totalScheduled) * 100 : 0;

    // Load Balancing Lists
    const overloadedStaff = staffMetrics.filter(s => s.metrics.loadStatus === 'Overloaded');
    const underutilizedStaff = staffMetrics.filter(s => s.metrics.loadStatus === 'Underutilized');

    return {
      totalStaff: branchStaff.length,
      totalScheduled,
      totalOT,
      totalTOIL,
      avgAttendance,
      leaveRate,
      overloadedStaff,
      underutilizedStaff,
      staffMetrics
    };
  }, [schedules, staffProfiles, currentDate, activeBranch]);

  return (
    <div className="space-y-8 pb-12" style={{ fontFamily: "'Montserrat', sans-serif" }}>

      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-8"
      >
        <div>
          <h2 className="text-3xl font-black text-white uppercase tracking-tight flex items-center gap-3">
            <div className="p-3 rounded-xl bg-[#0d1d1f] border border-[#388087] text-[#92cdb3]">
              <Activity size={24} />
            </div>
            Workforce <span className="text-[#92cdb3]">Intelligence</span>
          </h2>
          <p className="text-slate-400 font-medium mt-2 ml-16">
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} • {activeBranch === 'global' ? 'All Centers' : activeBranch.toUpperCase()}
          </p>
        </div>
      </motion.div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {[
          { label: 'Avg Attendance', value: `${Math.round(analytics.avgAttendance)}%`, icon: UserCheck, color: 'text-emerald-400', sub: 'Monthly Average' },
          { label: 'Leave Rate', value: `${analytics.leaveRate.toFixed(1)}%`, icon: UserX, color: 'text-rose-400', sub: 'Absenteeism' },
          { label: 'Total Overtime', value: `${analytics.totalOT}h`, icon: Clock, color: 'text-indigo-400', sub: 'Extra Hours' },
          { label: 'Total TOIL', value: analytics.totalTOIL, icon: Zap, color: 'text-purple-400', sub: 'Rest Day Work' },
          { label: 'Active Staff', value: analytics.totalStaff, icon: Users, color: 'text-[#92cdb3]', sub: 'Headcount' },
        ].map((stat, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.1 }}
            className={`${neumorphicCard} p-6 flex flex-col items-center justify-center relative overflow-hidden group`}
          >
            <div className={`absolute top-0 right-0 p-4 opacity-10 ${stat.color}`}>
              <stat.icon size={80} />
            </div>
            <h3 className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-2">{stat.label}</h3>
            <div className={`text-4xl font-black ${stat.color} mb-1`}>{stat.value}</div>
            <p className="text-xs text-slate-500 font-medium">{stat.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Load Balancing Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Overloaded Warning */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className={`${neumorphicCard} p-6`}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white uppercase tracking-tight flex items-center gap-2">
              <AlertCircle size={20} className="text-[#FFD633]" />
              High Load Warnings
            </h3>
            <span className="text-xs font-bold bg-[#FFD633]/20 text-[#FFD633] px-2 py-1 rounded">
              {analytics.overloadedStaff.length} Staff
            </span>
          </div>

          <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
            {analytics.overloadedStaff.length > 0 ? (
              analytics.overloadedStaff.map(staff => (
                <div key={staff.id} className="flex items-center justify-between p-3 rounded-xl bg-rose-900/20 border border-rose-500/30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-400 font-bold text-xs">
                      {staff.full_name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-200 text-sm">{staff.full_name}</p>
                      <p className="text-xs text-rose-400 font-medium">{staff.metrics.otHours}h OT • {staff.metrics.totalAssigned} Shifts</p>
                    </div>
                  </div>
                  <div className="text-xs font-bold text-rose-400 bg-rose-500/20 px-2 py-1 rounded shadow-sm">
                    OVERLOADED
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                <CheckCircle2 size={32} className="text-emerald-400 mb-2" />
                <p className="text-sm">Workload validated. No risks detected.</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Underutilized Opportunity */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className={`${neumorphicCard} p-6`}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white uppercase tracking-tight flex items-center gap-2">
              <BatteryCharging size={20} className="text-emerald-400" />
              Optimization Opportunities
            </h3>
            <span className="text-xs font-bold bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded">
              {analytics.underutilizedStaff.length} Staff
            </span>
          </div>

          <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
            {analytics.underutilizedStaff.length > 0 ? (
              analytics.underutilizedStaff.map(staff => (
                <div key={staff.id} className="flex items-center justify-between p-3 rounded-xl bg-emerald-900/20 border border-emerald-500/30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xs">
                      {staff.full_name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-200 text-sm">{staff.full_name}</p>
                      <p className="text-xs text-emerald-400 font-medium">Only {staff.metrics.totalAssigned} Shifts Assigned</p>
                    </div>
                  </div>
                  <div className="text-xs font-bold text-emerald-400 bg-emerald-500/20 px-2 py-1 rounded shadow-sm">
                    AVAILABLE
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                <p className="text-sm">All staff are actively utilized.</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Detailed Performance Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${neumorphicCard} p-6 overflow-hidden`}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white uppercase tracking-tight flex items-center gap-2">
            <Users size={20} className="text-slate-400" />
            Detailed Staff Performance
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#388087]">
                <th className="text-left py-4 px-4 font-bold text-slate-400 text-xs uppercase tracking-wider">Staff Member</th>
                <th className="text-center py-4 px-4 font-bold text-slate-400 text-xs uppercase tracking-wider">Attendance</th>
                <th className="text-center py-4 px-4 font-bold text-slate-400 text-xs uppercase tracking-wider">Shifts</th>
                <th className="text-center py-4 px-4 font-bold text-slate-400 text-xs uppercase tracking-wider">Leaves</th>
                <th className="text-center py-4 px-4 font-bold text-slate-400 text-xs uppercase tracking-wider">OT Hours</th>
                <th className="text-center py-4 px-4 font-bold text-slate-400 text-xs uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {analytics.staffMetrics.map((staff) => (
                <tr key={staff.id} className="border-b border-[#388087]/50 hover:bg-[#0d1d1f] transition-colors">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#27575b] flex items-center justify-center text-[#92cdb3] font-bold text-xs">
                        {staff.full_name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-slate-200 text-sm">{staff.full_name}</div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wide">{staff.role}</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-center py-4 px-4">
                    <div className="flex flex-col items-center">
                      <span className={`font-bold ${staff.metrics.attendanceScore >= 95 ? 'text-emerald-400' :
                        staff.metrics.attendanceScore >= 85 ? 'text-[#FFD633]' : 'text-rose-400'
                        }`}>
                        {Math.round(staff.metrics.attendanceScore)}%
                      </span>
                    </div>
                  </td>
                  <td className="text-center py-4 px-4 text-slate-300 font-medium">{staff.metrics.totalAssigned}</td>
                  <td className="text-center py-4 px-4">
                    {staff.metrics.leaveDays > 0 ? (
                      <span className="text-rose-400 font-bold bg-rose-500/20 px-2 py-1 rounded text-xs">{staff.metrics.leaveDays} Days</span>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>
                  <td className="text-center py-4 px-4 text-indigo-400 font-bold">
                    {staff.metrics.otHours > 0 ? `${staff.metrics.otHours}h` : '-'}
                  </td>
                  <td className="text-center py-4 px-4">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide ${staff.metrics.loadStatus === 'Overloaded' ? 'bg-rose-500/20 text-rose-400' :
                      staff.metrics.loadStatus === 'Underutilized' ? 'bg-emerald-500/20 text-emerald-400' :
                        'bg-[#27575b] text-slate-300'
                      }`}>
                      {staff.metrics.loadStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
};

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qqewusetilxxfvfkmsed.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxZXd1c2V0aWx4eGZ2Zmttc2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzNjI2NTUsImV4cCI6MjA3MDkzODY1NX0.-x783XXpilPWC3O-cJqmdSTmhpAvObk_MSElfGdrU8s';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const defaultPortals = [
  { name: 'CELPIP', url: 'https://www.celpip.ca', color: '#e31b23', logo: '/client-logos/celpip.jpg' },
  { name: 'CMA US', url: 'https://proscheduler.prometric.com/home', color: '#003399', logo: '/client-logos/cma_us.png' },
  { name: 'Pearson VUE', url: 'https://connect.pearsonvue.com/', color: '#0073e6', logo: '/client-logos/pearson_vue.png' },
  { name: 'Prometric', url: 'https://easyserve.prometric.com/my.policy', color: '#003366', logo: '/client-logos/prometric.png' },
  { name: 'PSI Exams', url: 'https://www.psiexams.com', color: '#e31b23', logo: '/client-logos/psi.png' }
];

async function seed() {
  const { data, error } = await supabase.from('fets_portals').select('*');
  if (error) {
    console.error('Error fetching portals:', error);
    return;
  }
  
  if (!data || data.length === 0) {
    console.log('No portals found in Supabase. Seeding default portals...');
    const { error: insertError } = await supabase.from('fets_portals').insert(defaultPortals);
    if (insertError) {
      console.error('Error inserting portals:', insertError);
    } else {
      console.log('Successfully seeded portals!');
    }
  } else {
    console.log('Portals already exist in Supabase:', data);
  }
}

seed();

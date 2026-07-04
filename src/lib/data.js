// 6 SKUs with random-generated 24-month data + intentional outliers
export const SKUS = [
  {
    id: 'DET-X200',
    name: 'Detergente Industrial X-200',
    family: 'Home Care',
    unit: 'Tn',
    values: [120,135,150,142,160,155,130,125,170,185,195,210,130,148,280,155,175,168,142,138,185,200,320,230]
  },
  {
    id: 'COS-CR50',
    name: 'Crema Hidratante Premium CR-50',
    family: 'Personal Care',
    unit: 'Uds',
    values: [4200,4500,4800,5100,5400,5200,4900,4700,5800,6200,6500,7100,4600,4900,5300,5600,5900,5700,5400,5200,6300,6800,7200,7800]
  },
  {
    id: 'DET-LQ80',
    name: 'Limpiador Multiusos LQ-80',
    family: 'Home Care',
    unit: 'L',
    values: [850,890,920,880,910,950,1200,1100,940,970,1000,1050,890,930,970,920,960,1000,1350,1050,990,1020,1060,1100]
  },
  {
    id: 'COS-SH25',
    name: 'Champú Anti-Caspa SH-25',
    family: 'Personal Care',
    unit: 'Uds',
    values: [2100,2200,2350,2280,2400,2500,2450,2380,2600,2750,2900,3100,2200,2320,2480,2400,2550,2680,2620,2560,2800,2950,3150,3400]
  },
  {
    id: 'DET-PW15',
    name: 'Detergente Polvo PW-15',
    family: 'Home Care',
    unit: 'Tn',
    values: [65,72,78,74,80,85,68,64,88,95,98,105,68,75,82,78,85,90,72,68,95,102,180,115]
  },
  {
    id: 'COS-PF10',
    name: 'Perfume Concentrado PF-10',
    family: 'Personal Care',
    unit: 'L',
    values: [180,195,210,205,220,235,215,210,245,265,280,310,195,210,225,220,235,250,230,225,265,285,305,340]
  }
]

export const MONTHS = ['Ene-25','Feb-25','Mar-25','Abr-25','May-25','Jun-25','Jul-25','Ago-25','Sep-25','Oct-25','Nov-25','Dic-25','Ene-26','Feb-26','Mar-26','Abr-26','May-26','Jun-26','Jul-26','Ago-26','Sep-26','Oct-26','Nov-26','Dic-26']
export const FUTURE_MONTHS = ['Ene-27','Feb-27','Mar-27','Abr-27','May-27','Jun-27']

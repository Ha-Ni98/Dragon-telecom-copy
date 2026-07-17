export type CommuneSeed = { communeCode: string; frName: string; arName: string };
export type WilayaSeed = { wilayaCode: string; frName: string; arName: string; communes: CommuneSeed[] };

// A small canonical subset of real Algerian wilayas/communes (bilingual), not the full 58/1541
// set — see plan-platform.md §7.1 and the Sprint P1 report for why: the spec's "69" doesn't match
// real-world Algeria (58 wilayas post-2019, confirmed against a vendored reference dataset at
// Mvp/frontend/src/config/algeria-{wilayas,commun}.json), and the owner deferred full geography
// seeding rather than commit to either number now. Codes/names below are drawn verbatim from that
// dataset (not invented) so this remains real data, just a slice of it — 3 wilayas chosen for a
// small commune-count spread (2 / 4 / 8) that still exercises multi-commune filtering in tests.
export const WILAYAS_REGISTRY: WilayaSeed[] = [
  {
    wilayaCode: '37',
    frName: 'Tindouf',
    arName: 'تندوف',
    communes: [
      { communeCode: '1254', frName: 'Oum El Assel', arName: 'أم العسل' },
      { communeCode: '1255', frName: 'Tindouf', arName: 'تندوف' },
    ],
  },
  {
    wilayaCode: '33',
    frName: 'Illizi',
    arName: 'إليزي',
    communes: [
      { communeCode: '1159', frName: 'Bordj Omar Driss', arName: 'برج عمر إدريس' },
      { communeCode: '1160', frName: 'Debdeb', arName: 'دبداب' },
      { communeCode: '1162', frName: 'Illizi', arName: 'إيليزي' },
      { communeCode: '1163', frName: 'In Amenas', arName: 'إن أمناس' },
    ],
  },
  {
    wilayaCode: '30',
    frName: 'Ouargla',
    arName: 'ورقلة',
    communes: [
      { communeCode: '1089', frName: 'Ain Beida', arName: 'عين البيضاء' },
      { communeCode: '1093', frName: 'El Borma', arName: 'البرمة' },
      { communeCode: '1095', frName: 'Hassi Ben Abdellah', arName: 'حاسي بن عبد الله' },
      { communeCode: '1096', frName: 'Hassi Messaoud', arName: 'حاسي مسعود' },
      { communeCode: '1100', frName: "N'goussa", arName: 'انقوسة' },
      { communeCode: '1101', frName: 'Ouargla', arName: 'ورقلة' },
      { communeCode: '1102', frName: 'Rouissat', arName: 'الرويسات' },
      { communeCode: '1103', frName: 'Sidi Khouiled', arName: 'سيدي خويلد' },
    ],
  },
];

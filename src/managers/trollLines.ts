import type { TrollIntensity } from './TrollIntensity';

/** Situations with their own lines. `trap:<type>` keys hold lines for a trap type. */
export type LineKey =
  | 'finishAfterManyDeaths'
  | 'nearFinish'
  | 'repeatTrap'
  | 'sameArea'
  | 'quickDeath'
  | 'passedTrap'
  | 'idle'
  | `trap:${string}`
  | `sprung:${string}`;

/**
 * Narrator lines per intensity. The first line of each list is the signature one and is used
 * first; after that lines rotate without repeating recently. Teasing is about the game only,
 * never about who the player is.
 */
export const TROLL_LINES: Record<TrollIntensity, Partial<Record<LineKey, string[]>>> = {
  soft: {
    finishAfterManyDeaths: ['Kamu berhasil! Bangga deh~', 'Pantang menyerah, keren!'],
    nearFinish: ['Hampir sampai! Kamu pasti bisa~', 'Sedikit lagi, semangat!'],
    repeatTrap: ['Jebakan ini licik ya. Coba lompat lebih awal!', 'Pelan-pelan, perhatikan polanya~'],
    sameArea: ['Kamu makin jago kok, coba lagi~', 'Bagian ini memang tricky, santai aja.'],
    quickDeath: ['Tarik napas dulu, santai~', 'Gapapa, pemanasan!'],
    passedTrap: ['Yay, kamu lolos!', 'Nah gitu! Keren!'],
    idle: ['Istirahat dulu? Gapapa kok~', 'Mochi nungguin kamu~'],
    'trap:fakeFloor': ['Lantainya nakal ya. Lihat retakannya!'],
    'trap:fallingPlatform': ['Papan kayu cepat jatuh, langsung lompat ya~'],
    'trap:surpriseSpikes': ['Ups, ada kejutan kecil!'],
    'trap:baitCoin': ['Koinnya jebakan, hehe. Lain kali skip aja~'],
    'trap:fakeCheckpoint': ['Bendera yang miring itu palsu, lho~'],
    'trap:spike': ['Hati-hati durinya ya~'],
    'trap:movingPlatform': ['Platformnya jalan terus, tunggu dia datang ya~', 'Lompat pas platformnya dekat, pelan-pelan~'],
    'sprung:baitCoin': ['Koinnya jebakan, hehe. Jalan di bawahnya aja~'],
    'sprung:fakeCheckpoint': ['Ups, bendera itu bohongan. Yang asli tegak lurus~'],
    'sprung:fakeFinish': ['Hehe, itu portal bohongan. Yang asli nanti muncul~'],
    'sprung:realFinish': ['Ini portal yang asli. Ayo, sedikit lagi!'],
    'trap:decoyPortal': ['Portalnya nakal ya. Coba perhatikan putarannya~'],
    'sprung:decoyPortal': ['Hehe, itu portal bohongan~', 'Ups, portal yang itu cuma pura-pura~'],
    'trap:mirrorPlatform': ['Yang berkilau-kilau itu cuma bayangan~', 'Platform asli diam, yang palsu goyang-goyang~'],
    'trap:ghostMochi': ['Bayanganmu bisa bantu, lho. Tunggu dia~', 'Coba diam sebentar di tombolnya~'],
    'trap:realityShift': ['Lihat lampunya dulu, baru lompat~', 'Yang mau hilang berkedip dulu, kok~'],
    'trap:lieDoor': ['Pintunya nakal ya. Ingat yang berkilau itu bohong~'],
    'sprung:lieDoor': ['Hehe, pintunya bawa kamu balik. Gapapa~'],
    'sprung:trueDoor': ['Pintu ini beneran terbuka. Ayo masuk~'],
    'trap:gravityFlip': ['Atas dan bawah lagi tukeran, pelan-pelan ya~', 'Lihat panah di gerbangnya dulu~'],
    'sprung:gravity': ['Wah, sekarang kamu jalan di langit-langit~'],
    'trap:dimension': ['Ups, dimensinya belum pas. Coba lagi~', 'Lihat garis putus-putusnya, itu dimensi sebelah~'],
    'trap:chaosChase': ['Lari terus, jangan berhenti ya~', 'Gelombangnya nggak secepat kamu, kok~'],
    'sprung:chase': ['Ada yang ngejar! Ayo lari~'],
    'sprung:collapse': ['Dunianya retak-retak, tapi kamu pasti bisa~'],
    'sprung:chaosFinish': ['Kamu berhasil sampai sini! Hebat banget~'],
  },
  chaos: {
    finishAfterManyDeaths: ['AKHIRNYA! GUA UDAH MAU PENSIUN!', 'Selamat… gua sampe ketiduran nunggunya.'],
    nearFinish: ['WKWKWK TINGGAL DIKIT LAGI!', 'PORTALNYA UDAH MELAMBAI, LHO!', 'SATU LANGKAH LAGI… YAH.', 'Finish-nya sampe kasihan liatnya.'],
    repeatTrap: ['Jebakan yang SAMA. Lagi. Serius?', 'Kalian pacaran ya sama jebakan itu?', 'Jebakannya sampe hafal muka Mochi.'],
    sameArea: ['Mau gua kasih tutorial lagi?', 'Area ini kayaknya kangen sama lu.', 'Udah kayak rumah sendiri ya di sini.'],
    quickDeath: ['LAH, BARU JUGA RESPAWN?!', 'Rekor! Hidup paling singkat!', 'Respawn-nya aja belum kering!'],
    passedTrap: ['EH?! KOK BISA LOLOS?!', 'Hmph. Hoki doang itu.', 'Oke oke, kali ini lu menang.'],
    idle: ['MOCHI, LU LAGI MIKIRIN HIDUP?', 'Halo? Masih main kan?', 'Gua bosen nih. Gerak dong~'],
    'trap:fakeFloor': ['LANTAINYA CUMA PURA-PURA SETIA.', 'Retaknya udah kelihatan, lho~'],
    'trap:fallingPlatform': ['Papan kayu kok dipercaya?', 'Turun bareng papannya, cie~'],
    'trap:surpriseSpikes': ['KEJUTAAAN! 🎉', 'BRO, ITU DURI BUKAN TEMEN!', 'Katanya aman, hehe.'],
    'trap:baitCoin': ['Koin gratis? Di game ini? 🤣', 'Serakah dikit, langsung kena.'],
    'trap:fakeCheckpoint': ['Bendera miring kok dipercaya?', 'Checkpoint-nya palsu, hehe.'],
    'trap:spike': ['BRO, ITU DURI BUKAN TEMEN!', 'Itu duri. Bukan bantal.', 'Durinya kelihatan jelas, lho…'],
    'trap:movingPlatform': ['Platformnya punya jadwal sendiri, bro.', 'Telat sedetik, langsung terjun. Hehe.'],
    'sprung:baitCoin': ['GRATIS? DI GAME INI? WKWK.', 'Koinnya manis, jebakannya lebih manis.'],
    'sprung:fakeCheckpoint': ['CHECKPOINT? PERCAYA AJA TERUS.', 'Benderanya miring, niatnya juga.'],
    'sprung:fakeFinish': ['FINISH? MANA ADA SEMUDAH ITU.', 'Portalnya kabur, hehe. Kejar dong!'],
    'sprung:realFinish': ['Oke oke… yang ini ASLI. Sumpah.'],
    'trap:decoyPortal': ['Portal KW kok dipercaya?', 'Portalnya cuma cosplay, bro.'],
    'sprung:decoyPortal': ['Portalnya cuma cosplay, bro.', 'Itu portal KW, hehe.'],
    'trap:mirrorPlatform': ['YANG ASLI YANG MANA NIH?', 'Itu bayangan, bukan lantai.'],
    'trap:ghostMochi': ['ITU BAYANGAN LU LEBIH JAGO!', 'Bayangannya sabar, lu nggak.'],
    'trap:realityShift': ['GAME-NYA NGGAK BOHONG KOK… MUNGKIN.', 'Lantainya lagi pindah dimensi, bro.'],
    'trap:lieDoor': ['WKWKWK KETIPU LAGI!', 'Pintunya cuma pajangan, hehe.'],
    'sprung:lieDoor': ['WKWKWK KETIPU LAGI!', 'Selamat datang kembali, hehe.'],
    'sprung:trueDoor': ['FINISH BENERAN? COBA AJA!'],
    'trap:gravityFlip': ['BRO, SEKARANG ATAS ITU BAWAH!', 'Langitnya juga bisa jadi jurang, lho.'],
    'sprung:gravity': ['BRO, SEKARANG ATAS ITU BAWAH!'],
    'trap:dimension': ['SALAH DIMENSI WKWKWK!', 'Lantainya ada, cuma beda dimensi.'],
    'trap:chaosChase': ['LARI BROOO! JANGAN NENGOK!', 'Gelombangnya nggak nunggu, bro.'],
    'sprung:chase': ['LARI BROOO! JANGAN NENGOK!'],
    'sprung:collapse': ['REALITASNYA AJA UDAH NYERAH SAMA LU!'],
    'sprung:chaosFinish': ['LAH, LU BENERAN BERHASIL?!'],
  },
  savage: {
    finishAfterManyDeaths: ['AKHIRNYA! Gua udah nulis surat wasiat tadi.', 'Selamat! Portalnya sampe tepuk tangan sambil nangis.'],
    nearFinish: ['PORTALNYA SAMPE NANGIS LIAT LU.', 'Jarak ke finish: 1 meter. Jarak ke skill: 1 kilometer.', 'Finish: hampir. Mochi: almarhum.'],
    repeatTrap: ['BRO. BRO. BRO. ITU JEBAKAN YANG SAMA.', 'Jebakan itu udah bayar kos di kepala lu.', 'Jebakan itu udah hafal nama lu.'],
    sameArea: ['Gua bikinin KTP aja ya buat area ini?', 'Area ini resmi jadi kuburan keluarga Mochi.'],
    quickDeath: ['SPEEDRUN MATI ANY%!', 'Hidup lu lebih singkat dari loading screen.', 'Respawn → mati. Efisien banget.'],
    passedTrap: ['HAH?! GLITCH YA?! GA MUNGKIN!', 'Lolos? Gua laporin ke admin.'],
    idle: ['Mochi AFK, narator mulai ngobrol sama tembok.', 'Mochi lagi buffering ya?'],
    'trap:fakeFloor': ['Lantai: 1. Kepercayaan lu: 0.', 'Lantainya selingkuh. Lagi.'],
    'trap:fallingPlatform': ['Papan kayu itu lebih setia ke gravitasi.', 'Selamat menikmati wahana jatuh bebas!'],
    'trap:surpriseSpikes': ['SURPRISEEE! Durinya udah nunggu dari tadi.', 'Jalan "aman" versi narator.'],
    'trap:baitCoin': ['Koinnya 1, nyawanya juga 1. Impas.', 'Mata duitan detected.'],
    'trap:fakeCheckpoint': ['Checkpoint palsu, harapan juga palsu.', 'Bendera miring aja dipercaya.'],
    'trap:spike': ['Duri itu kelihatan dari luar angkasa.', 'Peluk duri? Berani juga.'],
    'trap:movingPlatform': ['Platform itu nggak nungguin siapa-siapa.', 'Timing-nya meleset kayak sinyal di lift.'],
    'sprung:baitCoin': ['Mata duitan detected. Lagi.', 'Koin satu, nyawa satu. Impas, kan?'],
    'sprung:fakeCheckpoint': ['Trust issues level: bendera.', 'Checkpoint palsu, harapan juga palsu.'],
    'sprung:fakeFinish': ['Lu kira udah menang? Lucu.', 'Portal itu lari lebih kenceng dari Mochi.'],
    'sprung:realFinish': ['Yang ini asli. Mungkin. Hehe.'],
    'trap:decoyPortal': ['Portal KW, harapan juga KW.', 'Ditipu portal. Lagi.'],
    'sprung:decoyPortal': ['Lu kira itu finish? Gemes.', 'Portal KW detected.'],
    'trap:mirrorPlatform': ['Nginjek bayangan. Inovatif.', 'Lantainya HD, sayang cuma ilusi.'],
    'trap:ghostMochi': ['Bayangannya resign jadi partner lu.', 'Hantunya aja lebih sabar.'],
    'trap:realityShift': ['Realitas: 1. Mochi: 0.', 'Lantainya pindah dimensi tanpa pamit.'],
    'trap:lieDoor': ['Pintunya ketawa paling kenceng.', 'Masuk pintu palsu dengan percaya diri.'],
    'sprung:lieDoor': ['Balik lagi ke belakang. Nikmatin aja.', 'Pintunya ngusir lu, hehe.'],
    'sprung:trueDoor': ['Finish beneran? Gua juga kaget.'],
    'trap:gravityFlip': ['Gravitasi aja bingung sama arah lu.', 'Jatuh ke langit. Prestasi baru.'],
    'sprung:gravity': ['Atas jadi bawah. Rencana lu juga kebalik.'],
    'trap:dimension': ['Salah dimensi. Lagi. Konsisten.', 'Dimensinya dua, salahnya berkali-kali.'],
    'trap:chaosChase': ['Gelombangnya lebih niat daripada larinya.', 'Dikejar chaos, kalah sama chaos.'],
    'sprung:chase': ['Lari! Itu bukan ombak pantai.'],
    'sprung:collapse': ['Realitasnya resign duluan. Lu kapan?'],
    'sprung:chaosFinish': ['Serius sampai? Gua mau minta rekaman ulang.'],
  },
};

/** Extra lines a level brings for some keys and intensities (see LevelData.trollLines). */
export type LevelLines = Partial<Record<TrollIntensity, Partial<Record<LineKey, string[]>>>>;

/**
 * Lines for a key in an intensity: the level's own set first, then the shared set, falling back
 * to Chaos when a mode has none.
 */
export function linesFor(intensity: TrollIntensity, key: LineKey, level?: LevelLines): string[] | undefined {
  return level?.[intensity]?.[key] ?? TROLL_LINES[intensity][key] ?? TROLL_LINES.chaos[key];
}

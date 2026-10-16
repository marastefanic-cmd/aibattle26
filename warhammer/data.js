/* =====================================================================
   Warhammer companion: data.
   One file holds every army plus the faction and core rules they use.
   To add an army: append an object to ARMIES (units transcribed from the
   New Recruit PDF), add any new detachments/rules to FACTIONS, then bump
   VERSION here AND in version.json so installed apps reload themselves.

   Text markup used in rules text:
     **bold**   - a line starting "- " is a bullet   - *italic line*
   Phases: command | movement | shooting | charge | fight
   Turn:   your | opp | either
===================================================================== */
window.WH_DATA = (function(){

const VERSION = '2026-10-16.1';

/* ---------------- core rules (11th edition) ---------------- */
// Weapon keyword and core ability text, from the BSData wh40k-11e game system.
const RULES = {
  'Assault': 'Units containing one or more models with an **[ASSAULT]** weapon can shoot using **assault shooting** (10.05).',
  'Blast': 'Each time you gather attack dice for a **[BLAST]** weapon, add one additional **attack dice** for every five models that were in the target unit in the Select Targets step (rounding down). If this ability takes the form **[BLAST X]**, add **X** additional **attack dice** for every five models in the target unit instead.\n*Example: a [BLAST 2] weapon with A 3 targeting a 12-model unit gathers 4 extra dice, 7 in total.*',
  'Cleave': 'This ability always takes the form **[CLEAVE X]**. Each time you gather **attack dice** for a **[CLEAVE]** weapon, if you only selected one target for all of that weapon’s attacks, add **X** additional **attack dice** for every five models that were in the target unit in the Select Targets step (rounding down).\n*Example: a [CLEAVE 1] weapon with A 3 targeting one 16-model unit gathers 3 extra dice, 6 in total.*',
  'Close-quarters': 'Units containing one or more models with a **[CLOSE-QUARTERS]** weapon can shoot using **close-quarters shooting** (10.06). When using another **shooting type**, for each model in that unit (excluding **MONSTER/VEHICLE** models), you can only select one of the following to make attacks with:\n- One or more of its **[CLOSE-QUARTERS]** weapons.\n- One or more of its other ranged weapons.\n*[PISTOL] and [CLOSE-QUARTERS] are identical for all rules purposes.*',
  'Devastating Wounds': 'Each time an attack made with a **[DEVASTATING WOUNDS]** weapon results in a **critical wound**, the attack sequence for that attack ends and the target unit suffers a number of **mortal wounds** equal to the **D** characteristic of that weapon. These are inflicted after resolving any normal damage inflicted by those attacks.\n**Mortal wounds** inflicted by **[DEVASTATING WOUNDS]** weapons can damage a maximum of one model for each **critical wound**; any remaining **mortal wounds** inflicted by that attack are lost.',
  'Extra Attacks': 'Each time a unit containing one or more models with an **[EXTRA ATTACKS]** weapon fights, those models will make attacks with those weapons in addition to any others. In the Select Weapons step (04.01), for each of those models, you must select:\n- All of that model’s **[EXTRA ATTACKS]** weapons.\n- One of that model’s other melee weapons, if possible.',
  'Hazardous': 'Each time a unit is **selected to shoot** or **selected to fight**, after that unit has resolved all of its attacks, make a number of **hazard rolls** (06.03) for that unit equal to the number of **[HAZARDOUS]** weapons you selected in the Select Weapons step.',
  'Ignores Cover': 'Each time an attack is made with an **[IGNORES COVER]** weapon, the target cannot have the **benefit of cover** against that attack (13.08), including from rules that give a model or unit the **benefit of cover** (e.g. **Stealth**).',
  'Lethal Hits': 'Each time an attack made with a **[LETHAL HITS]** weapon results in a **critical hit**, you can choose for that attack to automatically wound the target.\n*Designer’s note: choosing to automatically wound means no wound roll is made, so that attack cannot become a critical wound and cannot trigger rules such as [DEVASTATING WOUNDS].*\n*The suffix “: non-MONSTER/VEHICLE” means it only applies against targets that are not MONSTER or VEHICLE units.*',
  'Precision': 'While resolving attacks made with one or more **[PRECISION]** weapons, at the start of the Allocation Order step (05.03), if the target unit contains one or more **CHARACTER** models **visible** to one or more of the attacking models, the active player can select one allocation group that contains one of those **visible CHARACTER** models. If they do, until those attacks are resolved, or until that **CHARACTER** group is **destroyed** (whichever happens first), that **CHARACTER** group is the current allocation group.',
  'Rapid Fire': 'This ability always takes the form **[RAPID FIRE X]**. Each time you gather **attack dice** for a **[RAPID FIRE]** weapon, add **X** additional **attack dice** if the target unit was within half range of that weapon in the Select Targets step.',
  'Sustained Hits': 'This ability always takes the form **[SUSTAINED HITS X]**. Each time an attack made with a **[SUSTAINED HITS]** weapon results in a **critical hit**, that attack results in a number of additional hits on the target as denoted by **X**.',
  'Torrent': 'Each time an attack is made with a **[TORRENT]** weapon, that attack automatically hits the target.',
  'Twin-linked': 'Each time an attack is made with a **[TWIN-LINKED]** weapon, you can re-roll the **wound roll**.',
  'Anti': 'This ability always takes the form **[ANTI-X Y+]**. Each time an attack is made with an **[ANTI]** weapon, if the target unit has the keyword denoted by **X**, an unmodified **wound roll** of **Y+** is a **critical wound**.\n*Example: [ANTI-VEHICLE 4+] against a VEHICLE unit is a critical wound on an unmodified 4+.*',
  'Hunter': 'Weapon profiles marked **Hunter: MONSTER/VEHICLE** are the profile to pick when attacking a **MONSTER** or **VEHICLE** unit; use the Standard profile against everything else.',

  'Deep Strike': 'Each time this unit makes an **ingress move** (20.04), if every model in this unit has this ability, it can be set up anywhere on the battlefield that is more than 8" horizontally from all enemy units, even if that is within your opponent’s deployment zone.',
  'Deadly Demise': 'This ability always takes the form **Deadly Demise X**. Each time a model in this unit is **destroyed**, after the units embarked within it (if any) have made their **emergency disembark moves**, roll one D6. On a 6, that model suffers a **deadly demise**; each unit within 6" of that model suffers a number of **mortal wounds** denoted by **X** (if this is a random number, roll separately for each unit within 6").',
  'Feel No Pain': 'This ability always takes the form **Feel No Pain X+**. Each time a model with this ability would lose a wound, roll one D6: on an **X+**, that wound is not lost.',
  'Leader': 'Before the battle, in the Muster Armies step, for each leader and support unit in your army, you can select one friendly bodyguard unit that unit can lead. That unit will then lead that bodyguard unit for the battle and form an attached unit with it. Unless otherwise stated, each bodyguard unit can only have one leader unit and one support unit attached to it.',
  'Lone Operative': 'Unless part of an **attached** unit, this unit is not **visible** to enemy models unless they are within 12" of this unit, and it cannot be targeted by **[INDIRECT FIRE]** weapons unless the attacking model is within 12" of this unit.',
  'Mobile': 'Models with the **MOBILE** keyword can move horizontally through **dense terrain features** (13.06).'
};

// Which RULES entry a keyword or rule chip opens ("RAPID FIRE 4" -> "Rapid Fire").
const RULE_ALIASES = [
  [/^anti-/i, 'Anti'], [/^blast/i, 'Blast'], [/^cleave/i, 'Cleave'], [/^close-quarters/i, 'Close-quarters'],
  [/^pistol/i, 'Close-quarters'], [/^devastating/i, 'Devastating Wounds'], [/^extra attacks/i, 'Extra Attacks'],
  [/^hazardous/i, 'Hazardous'], [/^ignores cover/i, 'Ignores Cover'], [/^lethal hits/i, 'Lethal Hits'],
  [/^precision/i, 'Precision'], [/^rapid fire/i, 'Rapid Fire'], [/^sustained hits/i, 'Sustained Hits'],
  [/^torrent/i, 'Torrent'], [/^twin-linked/i, 'Twin-linked'], [/^assault/i, 'Assault'],
  [/^deep strike/i, 'Deep Strike'], [/^deadly demise/i, 'Deadly Demise'], [/^feel no pain/i, 'Feel No Pain'],
  [/^leader/i, 'Leader'], [/^lone operative/i, 'Lone Operative'], [/^mobile/i, 'Mobile']
];

/* ---------------- core stratagems ----------------
   Short summaries, not the rulebook wording (marked "summary" in the app).
   target: keyword lists checked against each unit's keywords.            */
const CORE_STRATAGEMS = [
  { id:'command-re-roll', name:'Command Re-roll', cp:1, kind:'Battle Tactic', phases:['command','movement','shooting','charge','fight'], turn:'either',
    when:'Any phase, just after you make an Advance, Charge, Damage, Hazard, Hit, Save, Wound or number-of-attacks roll for a friendly unit.',
    target:'That unit or model.',
    effect:'Re-roll that roll. If several dice were rolled together, re-roll one of them (a Charge roll is re-rolled in full).' },
  { id:'counter-offensive', name:'Counter-offensive', cp:2, kind:'Strategic Ploy', phases:['fight'], turn:'either',
    when:'Fight phase, just after an enemy unit has fought.',
    target:'One friendly engaged unit that has not been selected to fight this phase.',
    effect:'Your unit fights next.' },
  { id:'epic-challenge', name:'Epic Challenge', cp:1, kind:'Epic Deed', phases:['fight'], turn:'either', needs:{ all:['Character'] },
    when:'Fight phase, when a friendly CHARACTER unit is selected to fight.',
    target:'One CHARACTER model in that unit.',
    effect:'That model’s melee attacks have **[PRECISION]**.' },
  { id:'insane-bravery', name:'Insane Bravery', cp:1, kind:'Battle Tactic', phases:['command'], turn:'your', limit:'Once per battle',
    when:'Battle-shock step of your Command phase, just before a friendly unit takes a battle-shock test.',
    target:'That unit.',
    effect:'Your unit automatically passes that test.' },
  { id:'crushing-impact', name:'Crushing Impact', cp:1, kind:'Strategic Ploy', phases:['charge'], turn:'your', needs:{ any:['Monster','Vehicle'] },
    when:'Your Charge phase, just after a friendly MONSTER or VEHICLE unit ends a charge move.',
    target:'That unit, and one enemy unit it is engaged with.',
    effect:'Roll D6 equal to the **T** of one of its models (max 6). Each 5+ inflicts 1 mortal wound on the enemy unit; each 1 inflicts 1 mortal wound on your unit. (Replaces Tank Shock.)' },
  { id:'explosives', name:'Explosives', cp:1, kind:'Wargear', phases:['shooting'], turn:'your', needs:{ any:['Explosives','Grenades'] },
    when:'Your Shooting phase.',
    target:'One friendly EXPLOSIVES unit that did not advance this turn, and one visible enemy unit within 8".',
    effect:'Roll six D6: each 4+ inflicts 1 mortal wound on that enemy unit. (Replaces Grenade.)' },
  { id:'fire-overwatch', name:'Fire Overwatch', cp:1, kind:'Strategic Ploy', phases:['movement'], turn:'opp', limit:'Once per turn', needs:{ none:['Titanic'] },
    when:'End of your opponent’s Movement phase.',
    target:'One friendly unengaged unit (excluding TITANIC).',
    effect:'Your unit **snap shoots** at one visible enemy unit within 24": hits only on unmodified 6s, and hit rolls cannot be re-rolled.' },
  { id:'heroic-intervention', name:'Heroic Intervention', cp:1, kind:'Strategic Ploy', phases:['charge'], turn:'opp',
    when:'Your opponent’s Charge phase, just after an enemy unit ends a charge move.',
    target:'One friendly unit within 6" that is eligible to charge.',
    effect:'**1CP:** your unit declares a charge against that enemy unit. **2CP:** it can instead charge any enemy unit within 6".' },
  { id:'rapid-ingress', name:'Rapid Ingress', cp:1, kind:'Strategic Ploy', phases:['movement'], turn:'opp', needs:{ none:['Aircraft'] },
    when:'End of your opponent’s Movement phase.',
    target:'One friendly unit in strategic reserves (excluding AIRCRAFT).',
    effect:'Your unit makes an **ingress move**.' },
  { id:'smokescreen', name:'Smokescreen', cp:1, kind:'Wargear', phases:['shooting'], turn:'opp', needs:{ all:['Smoke'] },
    when:'Your opponent’s Shooting phase, just after an enemy unit selects targets.',
    target:'One friendly SMOKE unit that was selected as a target.',
    effect:'Your unit has the **benefit of cover**, and also gives cover to units behind it.' }
];

/* ---------------- factions ---------------- */
const FACTIONS = {
  orks: {
    name: 'Orks',
    glyph: 'WAAAGH!',
    armyRules: [
      { name:'Waaagh!', text:'Friendly **ORKS** with this ability can:\n- Re-roll **advance rolls**.\n- Become **riled up**, as stated in other rules.\nWhile a unit is **riled up**:\n- That unit has 5+ **InSv**.\n- That unit’s ranged attacks have **[ASSAULT]**.\n- When that unit is selected to make an **advance move**, that **advance move** does not prevent that unit from being **eligible to declare a charge**.' },
      { name:'War Cry', tag:'Once per battle, per army', ph:['command'], turn:'your', track:'battle',
        text:'At the start of the Command phase, you can use this ability. If you do, friendly **ORKS** units with the **Waaagh!** ability are **riled up** until the end of the next turn.' },
      { name:'Da Boss', ph:['command'], turn:'either',
        text:'At the start of the battle round, if a model with this ability is your **WARLORD**, gain 1CP.' }
    ],
    detachments: {
      'brute-bosses': {
        name:'Brute Bosses', dp:1,
        rule:{ name:'’Ard As Nails', ph:['fight'], turn:'either',
          text:'When a friendly **WARBOSS** model is **destroyed**, if this unit has not been **selected to fight** this phase, roll one D6, with +1 to the roll if your unit is **riled up**:\n- On a 3+, do not remove this **WARBOSS** model from the battlefield. When this unit has fought, or at the end of the phase (whichever comes first), this **WARBOSS** model is removed from the battlefield.' },
        enhancements:[
          { name:'Brutal But Kunnin’', pts:30, text:'**WARBOSS** model only. This model’s melee attacks have +1 **D**.' },
          { name:'Da Gobshot Thunderbuss', pts:20, text:'**WARBOSS** model only. Ranged weapon: 24" A6 BS4+ S7 AP-2 D2 [LETHAL HITS: non-MONSTER/VEHICLE, RAPID FIRE 6].' },
          { name:'Blitzboss', pts:20, text:'**WARBOSS** model only. A **TRANSPORT** unit (excluding **WALKER** units) this unit is embarked within has:\n- +2" **M**.\n- 5+ **InSv**.' },
          { name:'Proper Killy', pts:null, text:'**WARBOSS** model only. This model can re-roll **hit rolls** of 1.' },
          { name:'Morgog’s Finkin’ Cap', pts:null, text:'**WARBOSS** model only. (Once per battle, per army) At the end of your opponent’s Movement phase, if this unit is **unengaged**, this unit can make a **normal move** of:\n- Up to D6".\n- If this unit is **riled up**, you can re-roll that D6.' },
          { name:'Surly As A Squiggoth', pts:25, text:'**INFANTRY WARBOSS** model only. (Once per battle, per army) At the end of phase in which this model is **destroyed**, roll one D6:\n- On a 2+, set this model back up on the battlefield as close as possible to where it was **destroyed**, **unengaged**, with 3 wounds remaining.' }
        ],
        stratagems:[]
      },
      'da-big-hunt': {
        name:'Da Big Hunt', dp:1,
        rule:{ name:'Da Hunt Is On', ph:['shooting','fight'], turn:'either',
          text:'Friendly **BEAST SNAGGA** units’ attacks that target a **MONSTER/VEHICLE** unit have +1 **AP**.' },
        enhancements:[
          { name:'Glory Hog', pts:25, text:'**BEAST SNAGGA** model only. When this unit is selected to make a **fall-back move**, that **fall-back move** does not prevent this unit from being **eligible to declare a charge**.' },
          { name:'It Came From Da Drops', pts:20, text:'**BEASTBOSS ON SQUIGOSAUR** model only. This model has +1 **T**.' }
        ],
        stratagems:[
          { id:'goaded-into-action', name:'Goaded Into Action', cp:1, phases:['shooting'], turn:'opp', needs:{ all:['Beast Snagga'] },
            when:'Your opponent’s Shooting phase, just after an enemy unit has shot.',
            target:'One friendly unengaged BEAST SNAGGA unit that lost one or more wounds to those attacks.',
            effect:'Your unit makes a **surge move** of up to D6". If it is **riled up**, you can re-roll that D6.' },
          { id:'instinctive-hunters', name:'Instinctive Hunters', cp:1, phases:['fight'], turn:'opp', needs:{ all:['Beast Snagga'] },
            when:'End of your opponent’s Fight phase.',
            target:'One friendly unengaged BEAST SNAGGA unit within 6" of a battlefield edge.',
            effect:'Place your unit into **strategic reserves**.' },
          { id:'where-dya-fink', name:'Where D’ya Fink You’re Going?', cp:1, phases:['movement'], turn:'opp', needs:{ all:['Beast Snagga'] },
            when:'Your opponent’s Movement phase, when an enemy unit engaged with a friendly BEAST SNAGGA unit is selected to fall back.',
            target:'That BEAST SNAGGA unit.',
            effect:'The enemy unit must fall back using **desperate escape**. If it is a MONSTER/VEHICLE unit, it makes 3 extra **hazard rolls**.' }
        ]
      },
      'dread-mob': {
        name:'Dread Mob', dp:1,
        rule:{ name:'Try Dat Button!', ph:['shooting','fight'], turn:'either',
          text:'In your Shooting phase or the Fight phase, when a friendly **ORKS WALKER** unit (excluding **TITANIC** units) is **selected to attack**, you can use this ability. If you do, roll either one D6 or two D6 (keep re-rolling duplicate results). This unit’s attacks have the relevant rule(s).\nIf you rolled two D6, when this unit has attacked, this unit makes one **hazard roll**.',
          table:[['1–2','+1 **A**'],['3–4','+2 **S**'],['5–6','+1 **AP**']] },
        enhancements:[
          { name:'Cybork Boosta', pts:10, text:'**BIG MEK/MEK** model only. This model has +2" **M**.' },
          { name:'Dreadherder', pts:30, text:'**BIG MEK** model only. While this model is within 3" of a friendly **ORKS WALKER** unit (excluding **BIG MEK** units):\n- This model has **Lone Operative**.\n- In your Shooting phase, you can select one friendly **ORKS WALKER** unit within 3" of this model. That unit’s attacks can re-roll **hit rolls** of 1 until the end of the turn.' }
        ],
        stratagems:[
          { id:'dread-power', name:'Dread Power', cp:1, phases:['movement'], turn:'your', needs:{ all:['Walker'] },
            when:'Your Movement phase.',
            target:'One friendly ORKS WALKER unit.',
            effect:'Your unit is **riled up** until the start of your next turn.' },
          { id:'stomping-juggernaut', name:'Stomping Juggernaut', cp:1, phases:['movement','charge'], turn:'your', needs:{ all:['Walker'] },
            when:'Your Movement or Charge phase, when a friendly ORKS WALKER unit is selected to move or declares a charge.',
            target:'That ORKS WALKER unit.',
            effect:'Your unit has the **MOBILE** keyword for that move, so it can move through dense terrain.' },
          { id:'crazed-rampage', name:'Crazed Rampage', cp:1, phases:['fight'], turn:'either', needs:{ all:['Walker'], none:['Titanic'] },
            when:'Fight phase, when an enemy unit selects a friendly ORKS WALKER unit (excluding TITANIC) as a target.',
            target:'That ORKS WALKER unit.',
            effect:'Each time a model in your unit is **destroyed** before your unit has fought this phase, roll one D6 (+3 if it is a DEFF DREAD): on a 4+, do not remove it until your unit has fought or the phase ends.' }
        ]
      }
    }
  }
};

/* ---------------- armies ----------------
   Unit fields:
     role   Epic Hero | Character | Battleline | Infantry | Mounted | Monster | Vehicle
     copies how many identical units the list has (New Recruit prints "x3")
     models lines from the "Models" box
     stats  one row per model profile
     ranged / melee  weapons; "group" joins the ➤ profiles of one weapon
     abilities  ph/turn tag the phase; track: battle|round adds a tick box in Game
     rules  core/faction rules that open a glossary entry
     kw     the unit's keywords ("Categories")                              */
const ARMIES = [
{
  id:'cooking', name:'Cooking', faction:'orks', points:2000, pointsUsed:2000,
  battleSize:'Strike Force', disposition:'Purge the Foe',
  detachments:['brute-bosses','da-big-hunt','dread-mob'],
  source:'New Recruit, exported 16 Oct 2026',
  units:[
    {
      id:'ghazghkull', name:'Ghazghkull Thraka', role:'Epic Hero', pts:290, warlord:true,
      models:['1× Ghazghkull Thraka'],
      stats:[{ name:'Ghazghkull Thraka', M:'8"', T:'10', Sv:'2+', W:'16', Ld:'6+', OC:'4', InSv:'4+', base:'80mm' }],
      ranged:[
        { group:'Mork’s Roar', name:'Point Blank', range:'9"', A:'2D6+2', BS:'–', S:'6', AP:'-1', D:'1', kw:['CLOSE-QUARTERS','TORRENT'] },
        { group:'Mork’s Roar', name:'Aimed', range:'36"', A:'12', BS:'5+', S:'6', AP:'-1', D:'1', kw:['LETHAL HITS: non-MONSTER/VEHICLE','RAPID FIRE 4'] }
      ],
      melee:[
        { name:'Adamantine ’Eadbutt', range:'Melee', A:'1', WS:'2+', S:'14', AP:'-2', D:'D3+3', kw:['DEVASTATING WOUNDS','EXTRA ATTACKS','PRECISION'] },
        { name:'Gork’s Klaw', range:'Melee', A:'7', WS:'2+', S:'14', AP:'-3', D:'4', kw:['CLEAVE 2','DEVASTATING WOUNDS'] }
      ],
      abilities:[
        { name:'Supreme Commander', text:'If this model is in your army, it must be your **WARLORD**.' },
        { name:'Makari, Hoist Dat Banner!', tag:'Once per battle, per army', ph:['movement'], turn:'your', track:'battle',
          text:'In your Movement phase, you can select a number of friendly **ORKS** units equal to or less than the current battle round number. Those units are **riled up** until the start of your next turn.\n*Place one Makari token next to the unit, removing it after this ability is used.*' },
        { name:'Da Grand Warlord’s Ladz', text:'While this unit is within 3" of another friendly **ORKS INFANTRY** unit, this unit has **Lone Operative**.' },
        { name:'Prophet of Da Great Waaagh!', tag:'Aura', ph:['fight'], turn:'either',
          text:'While a friendly **ORKS** unit is within 6" of this unit, that unit’s melee attacks have:\n- +1 to **hit rolls**.\n- +1 to **wound rolls**.' }
      ],
      rules:['Waaagh!','Da Boss'],
      kw:['Character','Epic Hero','Explosives','Faction: Orks','Ghazghkull Thraka','Infantry','Warboss','Warlord']
    },
    {
      id:'mozrog', name:'Mozrog Skragbad', role:'Epic Hero', pts:170,
      models:['1× Mozrog Skragbad'],
      stats:[{ name:'Mozrog Skragbad', M:'10"', T:'9', Sv:'3+', W:'10', Ld:'6+', OC:'3', InSv:'4+', base:'80mm' }],
      ranged:[
        { name:'Thump Gun', range:'18"', A:'3', BS:'5+', S:'6', AP:'0', D:'2', kw:['ANTI-MONSTER/VEHICLE 4+'] }
      ],
      melee:[
        { name:'Big Chompa’s Jaws', range:'Melee', A:'3', WS:'3+', S:'7', AP:'-2', D:'4', kw:['ANTI-MONSTER/VEHICLE 3+','EXTRA ATTACKS'] },
        { group:'Gutrippa', name:'Hunter', hunter:true, range:'Melee', A:'6', WS:'2+', S:'12', AP:'-2', D:'D6+1', kw:['LETHAL HITS'] },
        { group:'Gutrippa', name:'Standard', range:'Melee', A:'6', WS:'2+', S:'9', AP:'-2', D:'2', kw:['CLEAVE 1'] }
      ],
      abilities:[
        { name:'Beast Snagga Following', text:'While this unit is within 3" of a friendly **BEAST SNAGGA** unit (excluding **MONSTER CHARACTER** units), this unit has **Lone Operative**.' },
        { name:'One Last Kill', ph:['fight'], turn:'either',
          text:'In the Fight phase, when this model is **destroyed**, if this unit has not been **selected to fight** this phase, roll one D6:\n- On a 2+, do not remove this model from the battlefield. When this unit has fought, or at the end of the phase (whichever comes first), this model is removed from the battlefield.' },
        { name:'Da Bigger Dey Iz…', ph:['fight'], turn:'either',
          text:'This unit’s melee attacks that target a **MONSTER/VEHICLE** unit can re-roll **wound rolls**.' }
      ],
      rules:['Feel No Pain 5+','Waaagh!'],
      kw:['Beast Snagga','Character','Epic Hero','Faction: Orks','Monster','Mozrog Skragbad']
    },
    {
      id:'nazdreg', name:'Nazdreg', role:'Epic Hero', pts:355, ptsNote:'165 + Meganobz 190',
      leads:'Meganobz',
      models:['1× Nazdreg','3× Meganob w/ Kombi-weapon and Killsaw','2× Meganob w/ Kombi-weapon and Power Klaw'],
      stats:[
        { name:'Nazdreg', M:'5"', T:'7', Sv:'2+', W:'8', Ld:'6+', OC:'1', InSv:'5+', base:'60mm' },
        { name:'Meganob ×5', M:'5"', T:'6', Sv:'2+', W:'3', Ld:'7+', OC:'1', InSv:'–', base:'40mm' }
      ],
      ranged:[
        { group:'Kustom Blasta X', who:'Nazdreg', name:'Skorcha', range:'12"', A:'3', BS:'–', S:'5', AP:'-1', D:'1', kw:['BLAST 1','TORRENT','IGNORES COVER'] },
        { group:'Kustom Blasta X', who:'Nazdreg', name:'Gatler', range:'24"', A:'6', BS:'4+', S:'9', AP:'-2', D:'3', kw:['HAZARDOUS','IGNORES COVER'] },
        { group:'Kustom Blasta X', who:'Nazdreg', name:'Shoota', range:'18"', A:'4', BS:'4+', S:'5', AP:'-1', D:'1', kw:['LETHAL HITS: non-MONSTER/VEHICLE','RAPID FIRE 2','IGNORES COVER'] },
        { group:'Kombi-weapon', who:'Meganobz', n:5, name:'Point Blank', range:'12"', A:'3', BS:'–', S:'5', AP:'0', D:'1', kw:['BLAST 1','TORRENT','IGNORES COVER'] },
        { group:'Kombi-weapon', who:'Meganobz', n:5, name:'Kill Shot', range:'24"', A:'1', BS:'5+', S:'10', AP:'-2', D:'3', kw:['IGNORES COVER'] },
        { group:'Kombi-weapon', who:'Meganobz', n:5, name:'Shoota', range:'18"', A:'2', BS:'5+', S:'4', AP:'0', D:'1', kw:['LETHAL HITS: non-MONSTER/VEHICLE','RAPID FIRE 1','IGNORES COVER'] }
      ],
      melee:[
        { name:'Kustom Blasta X', who:'Nazdreg', range:'Melee', A:'6', WS:'2+', S:'5', AP:'-1', D:'1', kw:['CLEAVE 1','EXTRA ATTACKS'] },
        { name:'Moonchewa', who:'Nazdreg', range:'Melee', A:'5', WS:'2+', S:'12', AP:'-2', D:'3', kw:['CLEAVE 1','TWIN-LINKED'] },
        { name:'Killsaw', who:'Meganobz', n:3, range:'Melee', A:'3', WS:'4+', S:'10', AP:'-2', D:'3', kw:[] },
        { name:'Power Klaw', who:'Meganobz', n:2, range:'Melee', A:'3', WS:'3+', S:'10', AP:'-2', D:'2', kw:[] }
      ],
      abilities:[
        { name:'Nazdreg’s Know-wotz', who:'Nazdreg', text:'- This unit has **Deep Strike**.\n- This unit’s ranged attacks have **[IGNORES COVER]**.' },
        { name:'Supreme Kunnin’', who:'Nazdreg', tag:'Once per phase, per army', ph:['movement'], turn:'opp',
          text:'In your opponent’s Movement phase, when an enemy unit ends a move within 8" of this unit, if this unit is **unengaged**, this unit can:\n- Make a **normal move** of up to D6".\n- Or: if this unit is **riled up**, make a **normal move** of up to 5".' },
        { name:'Intimidating Motivation', who:'Nazdreg', tag:'Once per battle round, per army', ph:['movement'], turn:'your', track:'round',
          text:'In your Movement phase, at the start or end of this unit’s move, you can select one friendly **ORKS** unit within 6" of this unit. That unit:\n- Is no longer **battle-shocked**.\n- Is **riled up** until the start of your next turn.' },
        { name:'Krumpin’ Time', who:'Meganobz', ph:['fight'], turn:'either', text:'In the Fight phase, if this unit is **riled up**, this unit has +1 to **hit rolls**.' },
        { name:'Arrogant Invulnerability', who:'Meganobz', text:'Attacks that target this unit have -1 **AP**.' }
      ],
      rules:['Waaagh!','Leader','Da Boss','Deep Strike'],
      kw:['Character','Epic Hero','Faction: Orks','Infantry','Mega Armour','Nazdreg','Warboss','Explosives','Meganobz'],
      kwNote:'Explosives and Meganobz come from the attached Meganobz.'
    },
    {
      id:'beastboss-bbk', name:'Beastboss on Squigosaur', role:'Character', pts:170, enhancement:'Brutal But Kunnin’',
      models:['1× Beastboss on Squigosaur'],
      stats:[{ name:'Beastboss on Squigosaur', M:'10"', T:'9', Sv:'3+', W:'10', Ld:'6+', OC:'3', InSv:'5+', base:'80mm' }],
      ranged:[
        { name:'Slugga', range:'12"', A:'1', BS:'5+', S:'4', AP:'0', D:'1', kw:['CLOSE-QUARTERS','LETHAL HITS: non-MONSTER/VEHICLE'] }
      ],
      melee:[
        { group:'Beastchoppa', name:'Hunter', hunter:true, range:'Melee', A:'6', WS:'2+', S:'12', AP:'-2', D:'D6+1', kw:[], boosted:true },
        { group:'Beastchoppa', name:'Standard', range:'Melee', A:'6', WS:'2+', S:'6', AP:'-2', D:'3', kw:['CLEAVE 1'], boosted:true },
        { name:'Squigosaur’s jaws', range:'Melee', A:'3', WS:'3+', S:'7', AP:'-2', D:'4', kw:['ANTI-MONSTER/VEHICLE 3+','EXTRA ATTACKS'], boosted:true }
      ],
      boostNote:'Melee D already includes +1 from Brutal But Kunnin’.',
      abilities:[
        { name:'Thundering Stampede', tag:'Aura', ph:['charge'], turn:'your', text:'Friendly **BEAST SNAGGA** units within 6" of this unit have +1 to **charge rolls**.' },
        { name:'Boss of da Hunt', text:'While this unit is within 3" of a friendly **BEAST SNAGGA** unit (excluding **MONSTER CHARACTER** units), this unit has **Lone Operative**.' },
        { name:'Keep Huntin’!', tag:'Once per battle round, per army', ph:['movement'], turn:'your', track:'round',
          text:'In your Movement phase, at the start or end of this unit’s move, you can select one friendly **BEAST SNAGGA** unit within 6" of this unit. That unit:\n- Is no longer **battle-shocked**.\n- Is **riled up** until the start of your next turn.' },
        { name:'Brutal But Kunnin’', tag:'Enhancement', text:'**WARBOSS** model only. This model’s melee attacks have +1 **D**.' }
      ],
      rules:['Da Boss','Waaagh!','Feel No Pain 5+'],
      kw:['Beast Snagga','Beastboss on Squigosaur','Character','Faction: Orks','Monster','Warboss']
    },
    {
      id:'beastboss-gobshot', name:'Beastboss on Squigosaur', role:'Character', pts:160, enhancement:'Da Gobshot Thunderbuss',
      models:['1× Beastboss on Squigosaur'],
      stats:[{ name:'Beastboss on Squigosaur', M:'10"', T:'9', Sv:'3+', W:'10', Ld:'6+', OC:'3', InSv:'5+', base:'80mm' }],
      ranged:[
        { name:'Da Gobshot Thunderbuss', range:'24"', A:'6', BS:'4+', S:'7', AP:'-2', D:'2', kw:['LETHAL HITS: non-MONSTER/VEHICLE','RAPID FIRE 6'], enh:true },
        { name:'Slugga', range:'12"', A:'1', BS:'5+', S:'4', AP:'0', D:'1', kw:['CLOSE-QUARTERS','LETHAL HITS: non-MONSTER/VEHICLE'] }
      ],
      melee:[
        { group:'Beastchoppa', name:'Hunter', hunter:true, range:'Melee', A:'6', WS:'2+', S:'12', AP:'-2', D:'D6', kw:[] },
        { group:'Beastchoppa', name:'Standard', range:'Melee', A:'6', WS:'2+', S:'6', AP:'-2', D:'2', kw:['CLEAVE 1'] },
        { name:'Squigosaur’s jaws', range:'Melee', A:'3', WS:'3+', S:'7', AP:'-2', D:'3', kw:['ANTI-MONSTER/VEHICLE 3+','EXTRA ATTACKS'] }
      ],
      abilities:[
        { name:'Thundering Stampede', tag:'Aura', ph:['charge'], turn:'your', text:'Friendly **BEAST SNAGGA** units within 6" of this unit have +1 to **charge rolls**.' },
        { name:'Boss of da Hunt', text:'While this unit is within 3" of a friendly **BEAST SNAGGA** unit (excluding **MONSTER CHARACTER** units), this unit has **Lone Operative**.' },
        { name:'Keep Huntin’!', tag:'Once per battle round, per army', ph:['movement'], turn:'your', track:'round',
          text:'In your Movement phase, at the start or end of this unit’s move, you can select one friendly **BEAST SNAGGA** unit within 6" of this unit. That unit:\n- Is no longer **battle-shocked**.\n- Is **riled up** until the start of your next turn.' }
      ],
      rules:['Da Boss','Waaagh!','Feel No Pain 5+'],
      kw:['Beast Snagga','Beastboss on Squigosaur','Character','Faction: Orks','Monster','Warboss']
    },
    {
      id:'dakkarig-boosta', name:'Big Mek Dakkarig', role:'Character', pts:170, enhancement:'Cybork Boosta',
      models:['1× Big Mek Dakkarig'],
      stats:[{ name:'Big Mek Dakkarig', M:'10"', T:'8', Sv:'3+', W:'11', Ld:'7+', OC:'3', InSv:'5+', base:'90mm' }],
      boostNote:'M already includes +2" from Cybork Boosta.',
      ranged:[
        { name:'Blitzkannon', range:'24"', A:'8', BS:'4+', S:'7', AP:'-2', D:'2', kw:['IGNORES COVER','LETHAL HITS: non-MONSTER/VEHICLE'] },
        { name:'Multi-busta Launcha', range:'24"', A:'6', BS:'5+', S:'10', AP:'-2', D:'3', kw:['IGNORES COVER','LETHAL HITS'] }
      ],
      melee:[
        { name:'Stompy Feet', range:'Melee', A:'4', WS:'3+', S:'6', AP:'-1', D:'1', kw:[] }
      ],
      abilities:[
        { name:'Even More Dakka', ph:['shooting'], turn:'your', text:'If this unit is **riled up**, this unit’s ranged attacks have **[SUSTAINED HITS 1]**.' },
        { name:'Blitz Dem Gitz!', ph:['shooting'], turn:'your', text:'In your Shooting phase, if this unit’s Blitzkannon weapon targets a unit (excluding **MONSTER/VEHICLE** units), that weapon has +6 **A**.' },
        { name:'Cybork Boosta', tag:'Enhancement', text:'**BIG MEK/MEK** model only. This model has +2" **M**.' }
      ],
      rules:['Deadly Demise 1','Waaagh!'],
      kw:['Big Mek','Big Mek Dakkarig','Character','Faction: Orks','Vehicle','Walker']
    },
    {
      id:'dakkarig-herder', name:'Big Mek Dakkarig', role:'Character', pts:190, enhancement:'Dreadherder',
      models:['1× Big Mek Dakkarig'],
      stats:[{ name:'Big Mek Dakkarig', M:'8"', T:'8', Sv:'3+', W:'11', Ld:'7+', OC:'3', InSv:'5+', base:'90mm' }],
      ranged:[
        { name:'Blitzkannon', range:'24"', A:'8', BS:'4+', S:'7', AP:'-2', D:'2', kw:['IGNORES COVER','LETHAL HITS: non-MONSTER/VEHICLE'] },
        { name:'Multi-busta Launcha', range:'24"', A:'6', BS:'5+', S:'10', AP:'-2', D:'3', kw:['IGNORES COVER','LETHAL HITS'] }
      ],
      melee:[
        { name:'Stompy Feet', range:'Melee', A:'4', WS:'3+', S:'6', AP:'-1', D:'1', kw:[] }
      ],
      abilities:[
        { name:'Even More Dakka', ph:['shooting'], turn:'your', text:'If this unit is **riled up**, this unit’s ranged attacks have **[SUSTAINED HITS 1]**.' },
        { name:'Blitz Dem Gitz!', ph:['shooting'], turn:'your', text:'In your Shooting phase, if this unit’s Blitzkannon weapon targets a unit (excluding **MONSTER/VEHICLE** units), that weapon has +6 **A**.' },
        { name:'Dreadherder', tag:'Enhancement', ph:['shooting'], turn:'your',
          text:'**BIG MEK** model only. While this model is within 3" of a friendly **ORKS WALKER** unit (excluding **BIG MEK** units):\n- This model has **Lone Operative**.\n- In your Shooting phase, you can select one friendly **ORKS WALKER** unit within 3" of this model. That unit’s attacks can re-roll **hit rolls** of 1 until the end of the turn.' }
      ],
      rules:['Deadly Demise 1','Waaagh!'],
      kw:['Big Mek','Big Mek Dakkarig','Character','Faction: Orks','Vehicle','Walker']
    },
    {
      id:'gretchin', name:'Gretchin', role:'Infantry', pts:45, copies:3,
      models:['10× Gretchin'],
      stats:[{ name:'Gretchin ×10', M:'6"', T:'2', Sv:'6+', W:'1', Ld:'8+', OC:'1', InSv:'–', base:'25mm' }],
      ranged:[
        { name:'Grot Blasta', n:10, range:'12"', A:'1', BS:'4+', S:'3', AP:'0', D:'1', kw:['CLOSE-QUARTERS'] }
      ],
      melee:[
        { name:'Scavenged Shivs', n:10, range:'Melee', A:'1', WS:'5+', S:'2', AP:'0', D:'1', kw:[] }
      ],
      abilities:[
        { name:'Downtrodden', text:'For the purposes of **transport capacity**, each 2 Gretchin models (rounding up) take up the space of 1 model.' },
        { name:'Thievin’ Scavengers', ph:['movement'], turn:'your', text:'At the end of your Movement phase, if this unit is controlling an **objective**, that **objective** is **secured**.' }
      ],
      rules:['Waaagh!'],
      kw:['Faction: Orks','Gretchin','Grots','Infantry']
    },
    {
      id:'deffkoptas', name:'Deffkoptas', role:'Mounted', pts:85,
      models:['3× Deffkopta'],
      stats:[{ name:'Deffkoptas ×3', M:'12"', T:'6', Sv:'4+', W:'4', Ld:'7+', OC:'2', InSv:'6+', base:'75×42mm' }],
      ranged:[
        { group:'Rokkit Launcha', n:3, name:'Busta', range:'24"', A:'2', BS:'5+', S:'10', AP:'-2', D:'3', kw:['LETHAL HITS'] },
        { group:'Rokkit Launcha', n:3, name:'Blasta', range:'24"', A:'2', BS:'5+', S:'4', AP:'0', D:'1', kw:['BLAST 2'] },
        { name:'Slugga', n:3, range:'12"', A:'1', BS:'5+', S:'4', AP:'0', D:'1', kw:['CLOSE-QUARTERS','LETHAL HITS: non-MONSTER/VEHICLE'] }
      ],
      melee:[
        { name:'Choppa', n:3, range:'Melee', A:'3', WS:'4+', S:'5', AP:'-1', D:'1', kw:[] },
        { name:'Spinnin’ Blades', n:3, range:'Melee', A:'4', WS:'3+', S:'5', AP:'-1', D:'1', kw:['CLEAVE 1','HAZARDOUS'] }
      ],
      abilities:[
        { name:'Aerial Manoover', ph:['fight'], turn:'opp', text:'At the end of your opponent’s Fight phase, if this unit is **unengaged**, you can place this unit in **strategic reserves**.' },
        { name:'Deff from Above', ph:['shooting'], turn:'your', text:'In your Shooting phase, if this unit made an **ingress move** this turn, this unit’s ranged attacks have +1 to **hit rolls**.' }
      ],
      rules:['Deep Strike','Waaagh!'],
      kw:['Deffkoptas','Explosives','Faction: Orks','Fly','Mounted','Speed Freeks']
    },
    {
      id:'killa-kans', name:'Killa Kans', role:'Vehicle', pts:275,
      models:['6× Killa Kan'],
      stats:[{ name:'Killa Kan ×6', M:'8"', T:'7', Sv:'3+', W:'5', Ld:'8+', OC:'2', InSv:'6+', base:'60mm' }],
      ranged:[
        { group:'Kan Blasta', n:6, name:'Kill Shot', range:'24"', A:'2', BS:'4+', S:'10', AP:'-2', D:'3', kw:[] },
        { group:'Kan Blasta', n:6, name:'Point Blank', range:'12"', A:'3', BS:'–', S:'5', AP:'-1', D:'1', kw:['BLAST 2','TORRENT'] },
        { group:'Kan Blasta', n:6, name:'Dakka', range:'24"', A:'4', BS:'4+', S:'6', AP:'-1', D:'1', kw:['BLAST 1','IGNORES COVER','SUSTAINED HITS 1'] }
      ],
      melee:[
        { name:'Kan Klaw', n:6, range:'Melee', A:'3', WS:'4+', S:'8', AP:'-2', D:'3', kw:[] }
      ],
      abilities:[
        { name:'Spiteful Power Trip', ph:['shooting','fight'], turn:'either', text:'This unit’s attacks that target a unit that has no models with a **T** of 7+ have +1 to **hit rolls**.' }
      ],
      rules:['Deadly Demise 1','Waaagh!'],
      kw:['Faction: Orks','Grots','Killa Kans','Vehicle','Walker']
    }
  ]
}
];

return { version:VERSION, rules:RULES, ruleAliases:RULE_ALIASES, coreStratagems:CORE_STRATAGEMS, factions:FACTIONS, armies:ARMIES };
})();

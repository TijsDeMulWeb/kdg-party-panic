<?php

namespace App\Enums;

/** Badge keys of Party Panic in the Game Launcher. Badges themselves are managed in the launcher. */
enum Badge: string
{
    case FreePlay = 'free-play';
    case FirstParty = 'eerste-feest';
    case PartyAnimal = 'feestbeest';
    case Champion = 'kampioen';
    case Unbeatable = 'onverslaanbaar';
    case RoundWinner = 'rondewinnaar';
    case SoloDebut = 'solo-debuut';
    case ArcadeVeteran = 'arcade-veteraan';
    case Explorer = 'ontdekkingsreiziger';
    case DailyChallenge = 'dagelijkse-uitdaging';
    case ChallengeHunter = 'uitdagingsjager';
    case Perfectionist = 'perfectionist';
}

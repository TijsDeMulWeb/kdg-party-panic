<?php

namespace App\Support;

use App\Enums\Badge;
use App\Models\User;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Throwable;

use function Illuminate\Support\defer;

/**
 * Sends badge progress of a player to the Game Launcher.
 *
 * Guests have no launcher token and are skipped. Requests are sent after the response, so they never slow down
 * the game, and a failing request is reported but never breaks it.
 */
class LauncherBadges
{
    /** Earn a badge without a goal in one go. */
    public function earn(User $user, Badge $badge): void
    {
        $this->send($user, $badge, []);
    }

    /** Add to the progress of a badge with a goal. */
    public function increment(User $user, Badge $badge, int $amount = 1): void
    {
        $this->send($user, $badge, ['increment' => $amount]);
    }

    /** Set the progress of a badge to an exact value. The launcher never lowers progress. */
    public function setProgress(User $user, Badge $badge, int $progress): void
    {
        $this->send($user, $badge, ['progress' => $progress]);
    }

    /**
     * All badges of this game with the progress of the player.
     *
     * @return array<int, array<string, mixed>>
     */
    public function all(User $user): array
    {
        if (! $user->launcher_token) {
            return [];
        }

        try {
            return $this->client($user)->get('badges')->throw()->json('data');
        } catch (Throwable $exception) {
            report($exception);

            return [];
        }
    }

    /**
     * @param  array<string, int>  $data
     */
    private function send(User $user, Badge $badge, array $data): void
    {
        if (! $user->launcher_token) {
            return;
        }

        defer(function () use ($user, $badge, $data) {
            try {
                $this->client($user)->put("badges/{$badge->value}", $data)->throw();
            } catch (Throwable $exception) {
                report($exception);
            }
        });
    }

    private function client(User $user): PendingRequest
    {
        return Http::baseUrl(config('services.launcher.url').'/api')
            ->withToken($user->launcher_token)
            ->acceptJson()
            ->timeout(5);
    }
}

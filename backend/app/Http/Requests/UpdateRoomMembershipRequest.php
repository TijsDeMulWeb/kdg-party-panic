<?php

namespace App\Http\Requests;

use App\Models\Character;
use App\Models\Room;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateRoomMembershipRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('updateMembership', $this->route('room'));
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'is_ready' => ['sometimes', 'boolean'],
            'character' => ['sometimes', 'string', 'exists:characters,slug'],
        ];
    }

    /** @return array<int, callable> */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                if (! $this->filled('character')) {
                    return;
                }

                if ($this->characterIsTaken()) {
                    $validator->errors()->add('character', 'Someone else in the party already plays this character.');
                }
            },
        ];
    }

    public function characterId(): ?int
    {
        return Character::where('slug', $this->input('character'))->value('id');
    }

    protected function characterIsTaken(): bool
    {
        /** @var Room $room */
        $room = $this->route('room');

        return $room->players()
            ->whereKeyNot($this->user()->id)
            ->wherePivot('character_id', $this->characterId())
            ->exists();
    }
}

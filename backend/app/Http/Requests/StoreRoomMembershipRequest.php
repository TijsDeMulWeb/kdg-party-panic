<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreRoomMembershipRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('join', $this->route('room'));
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [];
    }
}

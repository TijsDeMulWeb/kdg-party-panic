<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StartRoundRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('start', $this->route('room'));
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [];
    }
}

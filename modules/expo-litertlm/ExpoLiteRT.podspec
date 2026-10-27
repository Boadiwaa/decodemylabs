require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ExpoLiteRT'
  s.version        = package['version']
  s.summary        = 'Android-first LiteRT-LM bridge for TalkingLabs'
  s.description    = 'Expo module exposing LiteRT-LM APIs. iOS currently provides a stub implementation.'
  s.homepage       = 'https://github.com/example/expo-litertlm'
  s.license        = 'MIT'
  s.author         = 'TalkingLabs'
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.source_files   = 'ios/**/*.{h,m,mm,swift}'
  s.swift_version  = '5.0'

  s.dependency 'ExpoModulesCore'
end
